import json
import os
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

import boto3
import requests
from aws_lambda_powertools import Logger
from aws_lambda_powertools.event_handler import BedrockAgentResolver
from aws_lambda_powertools.utilities.typing import LambdaContext
from geopy.distance import geodesic
from geopy.geocoders import Nominatim

logger = Logger()
app = BedrockAgentResolver()

# API Configuration
API_BASE_URL = os.getenv("WAKAMATE_API_BASE_URL", "http://localhost:1050")
AUTH_TOKEN = os.getenv("WAKAMATE_AUTH_TOKEN", "")


def make_api_request(
    endpoint: str, method: str = "GET", data: Optional[Dict] = None
) -> Dict[str, Any]:
    """Make authenticated request to Wakamate API"""
    try:
        url = f"{API_BASE_URL}{endpoint}"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {AUTH_TOKEN}",
        }

        if method == "GET":
            response = requests.get(url, headers=headers, timeout=30)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data, timeout=30)
        else:
            return {"error": f"Unsupported HTTP method: {method}"}

        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        logger.error(f"API request failed: {str(e)}")
        return {"error": f"API request failed: {str(e)}"}


# =====================
# INVENTORY OPERATIONS
# =====================


@app.post("/getInventorySummary")
def get_inventory_summary():
    """Get comprehensive inventory summary"""
    try:
        products = make_api_request("/api/products/getAll")

        if isinstance(products, dict) and "error" in products:
            return products

        if not isinstance(products, list):
            return {"error": "Invalid products data"}

        total_value = 0
        total_revenue = 0
        out_of_stock = []
        low_stock = []

        for product in products:
            stock = product.get("stock", 0)
            cost_price = product.get("costPrice", 0)
            selling_price = product.get("sellingPrice", 0)

            total_value += stock * cost_price
            total_revenue += stock * selling_price

            if stock == 0:
                out_of_stock.append(product.get("name", "Unknown"))
            elif product.get("lowStock", False):
                low_stock.append(product.get("name", "Unknown"))

        return {
            "total_products": len(products),
            "total_inventory_value": round(total_value, 2),
            "total_potential_revenue": round(total_revenue, 2),
            "total_potential_profit": round(total_revenue - total_value, 2),
            "out_of_stock_items": out_of_stock,
            "low_stock_items": low_stock,
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        logger.error(f"Error in getInventorySummary: {str(e)}")
        return {"error": f"Failed to get inventory summary: {str(e)}"}


@app.post("/getProfitabilityAnalysis")
def get_profitability_analysis():
    """Analyze product profitability"""
    try:
        products = make_api_request("/api/products/getAll")

        if isinstance(products, dict) and "error" in products:
            return products

        profit_data = []
        for product in products:
            cost_price = product.get("costPrice", 0)
            selling_price = product.get("sellingPrice", 0)
            stock = product.get("stock", 0)
            units_sold = product.get("unitsSold", 0)

            if selling_price > 0:
                profit_margin = ((selling_price - cost_price) / selling_price) * 100
                potential_profit = (selling_price - cost_price) * stock
                realized_profit = (selling_price - cost_price) * units_sold

                profit_data.append(
                    {
                        "name": product.get("name", "Unknown"),
                        "margin": round(profit_margin, 2),
                        "potential_profit": round(potential_profit, 2),
                        "realized_profit": round(realized_profit, 2),
                        "stock": stock,
                        "units_sold": units_sold,
                    }
                )

        # Sort by potential profit
        profit_data.sort(key=lambda x: x["potential_profit"], reverse=True)

        return {
            "top_profit_opportunities": profit_data[:10],
            "low_margin_products": [p for p in profit_data if p["margin"] < 25][:5],
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        logger.error(f"Error in getProfitabilityAnalysis: {str(e)}")
        return {"error": f"Failed to analyze profitability: {str(e)}"}


@app.post("/getRestockRecommendations")
def get_restock_recommendations():
    """Generate restocking recommendations"""
    try:
        products = make_api_request("/api/products/getAll")

        if isinstance(products, dict) and "error" in products:
            return products

        critical_items = []
        high_priority = []

        for product in products:
            name = product.get("name", "Unknown")
            stock = product.get("stock", 0)
            units_sold = product.get("unitsSold", 0)
            cost_price = product.get("costPrice", 0)
            min_stock = product.get("minStock", 0)

            # Calculate velocity
            daily_velocity = units_sold / 30 if units_sold > 0 else 0.1
            days_until_stockout = stock / daily_velocity if daily_velocity > 0 else 999

            if stock == 0:
                recommended_qty = max(20, min_stock * 2)
                critical_items.append(
                    {
                        "name": name,
                        "current_stock": 0,
                        "recommended_quantity": recommended_qty,
                        "investment_needed": round(recommended_qty * cost_price, 2),
                        "reason": "OUT_OF_STOCK",
                    }
                )
            elif stock <= min_stock or days_until_stockout <= 14:
                recommended_qty = max(min_stock * 2, int(daily_velocity * 21))
                high_priority.append(
                    {
                        "name": name,
                        "current_stock": stock,
                        "recommended_quantity": recommended_qty,
                        "investment_needed": round(recommended_qty * cost_price, 2),
                        "days_until_stockout": round(days_until_stockout, 1),
                    }
                )

        return {
            "critical_restocks": critical_items,
            "high_priority_restocks": high_priority[:10],
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        logger.error(f"Error in getRestockRecommendations: {str(e)}")
        return {"error": f"Failed to generate restock recommendations: {str(e)}"}


# =====================
# CAPTION GENERATION
# =====================


@app.post("/getProductsForCaption")
def get_products_for_caption():
    """Get all products for caption generation"""
    properties = app.current_event.request_body.content.get(
        "application/json"
    ).properties

    try:
        # Extract optional product filter
        product_filter = None
        for prop in properties:
            if prop["name"] == "product_filter":
                product_filter = prop["value"]

        products = make_api_request("/api/products/getAll")

        if isinstance(products, dict) and "error" in products:
            return products

        # Filter products if specified
        if product_filter:
            filter_lower = product_filter.lower()
            products = [
                p
                for p in products
                if filter_lower in p.get("name", "").lower()
                or filter_lower in p.get("category", "").lower()
            ]

        # Format for caption generation
        formatted_products = []
        for product in products[:10]:  # Limit to 10 for performance
            formatted_products.append(
                {
                    "name": product.get("name", "Unknown"),
                    "category": product.get("category", "General"),
                    "price": product.get("sellingPrice", 0),
                    "description": product.get("description", ""),
                    "stock": product.get("stock", 0),
                }
            )

        return {
            "products": formatted_products,
            "total_count": len(products),
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        logger.error(f"Error in getProductsForCaption: {str(e)}")
        return {"error": f"Failed to get products: {str(e)}"}


@app.post("/findProductByName")
def find_product_by_name():
    """Find specific product by name"""
    properties = app.current_event.request_body.content.get(
        "application/json"
    ).properties

    try:
        product_name = next(
            (p["value"] for p in properties if p["name"] == "product_name"), None
        )

        if not product_name:
            return {"error": "Product name is required"}

        products = make_api_request("/api/products/getAll")

        if isinstance(products, dict) and "error" in products:
            return products

        # Find matching product
        product_name_lower = product_name.lower()
        matching_product = None

        for product in products:
            if product_name_lower in product.get("name", "").lower():
                matching_product = product
                break

        if not matching_product:
            return {"error": f"Product '{product_name}' not found in inventory"}

        return {
            "name": matching_product.get("name", "Unknown"),
            "category": matching_product.get("category", "General"),
            "price": matching_product.get("sellingPrice", 0),
            "description": matching_product.get("description", ""),
            "stock": matching_product.get("stock", 0),
            "cost_price": matching_product.get("costPrice", 0),
        }
    except Exception as e:
        logger.error(f"Error in findProductByName: {str(e)}")
        return {"error": f"Failed to find product: {str(e)}"}


# =====================
# DELIVERY ROUTE OPERATIONS
# =====================


@app.post("/geocodeAddress")
def geocode_address():
    """Geocode an address to get coordinates"""
    properties = app.current_event.request_body.content.get(
        "application/json"
    ).properties

    try:
        address = next((p["value"] for p in properties if p["name"] == "address"), None)

        if not address:
            return {"error": "Address is required"}

        geolocator = Nominatim(user_agent="wakamate_delivery", timeout=10)
        location = geolocator.geocode(f"{address}, Lagos, Nigeria")

        if location:
            return {
                "address": address,
                "latitude": location.latitude,
                "longitude": location.longitude,
                "full_address": location.address,
                "success": True,
            }
        else:
            return {"error": f"Could not geocode address: {address}"}
    except Exception as e:
        logger.error(f"Error in geocodeAddress: {str(e)}")
        return {"error": f"Geocoding failed: {str(e)}"}


@app.post("/optimizeRoute")
def optimize_route():
    """Optimize delivery route using TSP algorithm"""
    properties = app.current_event.request_body.content.get(
        "application/json"
    ).properties

    try:
        addresses_str = next(
            (p["value"] for p in properties if p["name"] == "addresses"), None
        )

        if not addresses_str:
            return {"error": "Addresses list is required"}

        # Parse addresses
        import json as json_lib

        try:
            addresses = (
                json_lib.loads(addresses_str)
                if addresses_str.startswith("[")
                else addresses_str.split(",")
            )
        except:
            addresses = [a.strip() for a in addresses_str.split(",")]

        if len(addresses) < 2:
            return {"error": "Need at least 2 addresses for route optimization"}

        # Geocode all addresses
        geolocator = Nominatim(user_agent="wakamate_delivery", timeout=10)
        locations = []

        for addr in addresses:
            location = geolocator.geocode(f"{addr.strip()}, Lagos, Nigeria")
            if location:
                locations.append(
                    {
                        "address": addr.strip(),
                        "latitude": location.latitude,
                        "longitude": location.longitude,
                    }
                )
            time.sleep(1)  # Rate limiting

        if len(locations) < 2:
            return {"error": "Could not geocode enough addresses"}

        # Simple nearest neighbor TSP
        route_indices = [0]  # Start at first location
        unvisited = set(range(1, len(locations)))
        total_distance = 0

        while unvisited:
            current = route_indices[-1]
            current_loc = locations[current]

            nearest_idx = None
            nearest_dist = float("inf")

            for idx in unvisited:
                next_loc = locations[idx]
                dist = geodesic(
                    (current_loc["latitude"], current_loc["longitude"]),
                    (next_loc["latitude"], next_loc["longitude"]),
                ).kilometers

                if dist < nearest_dist:
                    nearest_dist = dist
                    nearest_idx = idx

            route_indices.append(nearest_idx)
            unvisited.remove(nearest_idx)
            total_distance += nearest_dist

        optimized_route = [locations[i]["address"] for i in route_indices]
        avg_speed = 25  # km/h average in Lagos
        estimated_time = (total_distance / avg_speed) + (
            len(locations) * 0.5
        )  # 30min per stop

        return {
            "optimized_route": optimized_route,
            "total_distance_km": round(total_distance, 2),
            "estimated_time_hours": round(estimated_time, 2),
            "num_stops": len(locations),
            "success": True,
        }
    except Exception as e:
        logger.error(f"Error in optimizeRoute: {str(e)}")
        return {"error": f"Route optimization failed: {str(e)}"}


@app.post("/getTrafficInfo")
def get_traffic_info():
    """Get current traffic information"""
    try:
        current_hour = datetime.now().hour

        if 7 <= current_hour <= 10:
            level = "heavy"
            multiplier = 2.1
            advice = "Morning rush hour - expect significant delays"
        elif 16 <= current_hour <= 19:
            level = "severe"
            multiplier = 2.8
            advice = "Evening rush peak - consider alternative routes"
        elif 10 <= current_hour <= 15:
            level = "moderate"
            multiplier = 1.3
            advice = "Optimal delivery window"
        else:
            level = "light"
            multiplier = 1.0
            advice = "Excellent delivery conditions"

        return {
            "traffic_level": level,
            "time_multiplier": multiplier,
            "advice": advice,
            "current_time": datetime.now().strftime("%H:%M"),
            "timestamp": datetime.now().isoformat(),
        }
    except Exception as e:
        logger.error(f"Error in getTrafficInfo: {str(e)}")
        return {"error": f"Failed to get traffic info: {str(e)}"}


@logger.inject_lambda_context
def handler(event: dict, context: LambdaContext):
    """Main Lambda handler"""
    print(event)
    return app.resolve(event, context)
