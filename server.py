#!/usr/bin/env python3
"""
THE 2ND WIFE FAMILY RESTURANT  - Fullstack Web Platform Server
A complete, self-contained server with SQLite, REST APIs, Auth, and Static File Serving.
Runs on standard Python 3 with zero external dependencies.
"""

import os
import sys
import json
import sqlite3
import hashlib
import secrets
import mimetypes
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime

PORT = int(os.environ.get("PORT", 8000))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
DB_PATH = os.path.join(BASE_DIR, "restaurant.db")

# Helper for Password Hashing
def hash_password(password: str, salt: str = None) -> str:
    if not salt:
        salt = secrets.token_hex(8)
    hashed = hashlib.sha256((salt + password).encode('utf-8')).hexdigest()
    return f"{salt}:{hashed}"

def verify_password(stored: str, provided: str) -> bool:
    try:
        salt, hashed = stored.split(":")
        return hashlib.sha256((salt + provided).encode('utf-8')).hexdigest() == hashed
    except Exception:
        return False

# Database Initialization
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()

    # App Settings & Restaurant Config
    c.execute('''
    CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    ''')

    # Users Table
    c.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'customer',
        phone TEXT,
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Sessions Table
    c.execute('''
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    ''')

    # Categories Table
    c.execute('''
    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        icon TEXT,
        image_url TEXT,
        display_order INTEGER DEFAULT 0
    )
    ''')

    # Menu Items Table
    c.execute('''
    CREATE TABLE IF NOT EXISTS menu_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        original_price REAL,
        image_url TEXT NOT NULL,
        is_veg INTEGER DEFAULT 1,
        is_bestseller INTEGER DEFAULT 0,
        is_available INTEGER DEFAULT 1,
        rating REAL DEFAULT 4.6,
        rating_count INTEGER DEFAULT 128,
        spice_level INTEGER DEFAULT 1,
        preparation_time TEXT DEFAULT '20-25 mins',
        has_half_full INTEGER DEFAULT 0,
        half_price REAL DEFAULT 0,
        full_price REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(category_id) REFERENCES categories(id)
    )
    ''')

    # Migration check for columns
    c.execute("PRAGMA table_info(menu_items)")
    cols = [r["name"] for r in c.fetchall()]
    if "has_half_full" not in cols:
        c.execute("ALTER TABLE menu_items ADD COLUMN has_half_full INTEGER DEFAULT 0")
    if "half_price" not in cols:
        c.execute("ALTER TABLE menu_items ADD COLUMN half_price REAL DEFAULT 0")
    if "full_price" not in cols:
        c.execute("ALTER TABLE menu_items ADD COLUMN full_price REAL DEFAULT 0")

    # Coupons & Offers Table
    c.execute('''
    CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        discount_type TEXT NOT NULL, -- 'percentage' or 'flat'
        discount_value REAL NOT NULL,
        max_discount REAL DEFAULT 0,
        min_order_amount REAL DEFAULT 199,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')

    # Orders Table
    c.execute('''
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT UNIQUE NOT NULL,
        user_id INTEGER,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_email TEXT,
        delivery_address TEXT NOT NULL,
        order_type TEXT DEFAULT 'delivery',
        items_json TEXT NOT NULL,
        subtotal REAL NOT NULL,
        discount_amount REAL DEFAULT 0,
        coupon_code TEXT,
        delivery_fee REAL DEFAULT 0,
        taxes REAL DEFAULT 0,
        packaging_fee REAL DEFAULT 0,
        grand_total REAL NOT NULL,
        payment_method TEXT DEFAULT 'Cash on Delivery',
        payment_status TEXT DEFAULT 'Pending',
        order_status TEXT DEFAULT 'Placed', -- 'Placed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'
        special_instructions TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    ''')

    # Table Reservations Table
    c.execute('''
    CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        guest_name TEXT NOT NULL,
        guest_email TEXT NOT NULL,
        guest_phone TEXT NOT NULL,
        reservation_date TEXT NOT NULL,
        reservation_time TEXT NOT NULL,
        guest_count INTEGER NOT NULL,
        seating_preference TEXT DEFAULT 'Standard',
        special_requests TEXT,
        status TEXT DEFAULT 'Pending', -- 'Pending', 'Confirmed', 'Cancelled'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )
    ''')

    # Seed Default Config
    default_configs = [
        ("restaurant_name", "THE SECOND WIFE FAMILY RESTAURANT"),
        ("restaurant_tagline", "Gourmet Bites, Craveable Delights & Swift Delivery"),
        ("restaurant_phone", "+91 98765 43210"),
        ("restaurant_email", "support@xyzrestaurant.com"),
        ("restaurant_address", "42 Gourmet Boulevard, Food District, City"),
        ("delivery_fee", "40"),
        ("free_delivery_threshold", "499"),
        ("tax_rate_percent", "5.0"),
        ("packaging_charge", "25")
    ]
    for key, val in default_configs:
        c.execute("INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)", (key, val))

    # Seed Admin and Demo User if not exist
    c.execute("SELECT COUNT(*) as count FROM users WHERE role = 'admin'")
    if c.fetchone()["count"] == 0:
        admin_pass = hash_password("admin123")
        c.execute("""
            INSERT INTO users (name, email, password_hash, role, phone, address)
            VALUES (?, ?, ?, 'admin', ?, ?)
        """, ("Admin XYZ", "admin@xyz.com", admin_pass, "+91 99999 88888", "THE SECOND WIFE FAMILY RESTAURANT HQ"))

    c.execute("SELECT COUNT(*) as count FROM users WHERE email = 'customer@xyz.com'")
    if c.fetchone()["count"] == 0:
        cust_pass = hash_password("customer123")
        c.execute("""
            INSERT INTO users (name, email, password_hash, role, phone, address)
            VALUES (?, ?, ?, 'customer', ?, ?)
        """, ("Aryan Bhushan", "customer@xyz.com", cust_pass, "+91 98765 12345", "Apt 4B, Sunshine Towers, Sector 14"))

    # Seed Categories and Menu Items from menu_seed.json if available
    c.execute("SELECT COUNT(*) as count FROM menu_items")
    if c.fetchone()["count"] == 0:
        seed_path = os.path.join(BASE_DIR, "menu_seed.json")
        if os.path.exists(seed_path):
            with open(seed_path, "r", encoding="utf-8") as f:
                seed_data = json.load(f)
            # Insert categories
            c.execute("SELECT COUNT(*) as count FROM categories")
            if c.fetchone()["count"] == 0:
                for cat in seed_data.get("categories", []):
                    c.execute("""
                        INSERT INTO categories (name, slug, icon, image_url, display_order)
                        VALUES (?, ?, ?, ?, ?)
                    """, (cat["name"], cat["slug"], cat["icon"], cat["image_url"], cat["display_order"]))

            cats = {row["slug"]: row["id"] for row in c.execute("SELECT id, slug FROM categories").fetchall()}

            for item in seed_data.get("items", []):
                cat_id = cats.get(item.get("category_slug"), 1)
                c.execute("""
                    INSERT INTO menu_items (
                        category_id, name, description, price, original_price, image_url,
                        is_veg, is_bestseller, is_available, rating, rating_count, spice_level,
                        preparation_time, has_half_full, half_price, full_price
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    cat_id, item["name"], item["description"], item["price"], item["original_price"],
                    item["image_url"], item["is_veg"], item["is_bestseller"], item["is_available"],
                    item["rating"], item["rating_count"], item["spice_level"], item["preparation_time"],
                    item.get("has_half_full", 0), item.get("half_price", 0), item.get("full_price", 0)
                ))

            # Seed coupons
            c.execute("SELECT COUNT(*) as count FROM coupons")
            if c.fetchone()["count"] == 0:
                for coup in seed_data.get("coupons", []):
                    c.execute("""
                        INSERT INTO coupons (code, title, description, discount_type, discount_value, max_discount, min_order_amount, is_active)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        coup["code"], coup["title"], coup["description"], coup["discount_type"],
                        coup["discount_value"], coup["max_discount"], coup["min_order_amount"], coup["is_active"]
                    ))

    conn.commit()
    conn.close()
    print("✅ Database initialized successfully with tables and seed data.")

# HTTP Request Handler
class RestaurantRequestHandler(BaseHTTPRequestHandler):

    def send_json(self, data, status_code=200, extra_headers=None):
        payload = json.dumps(data).encode('utf-8')
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        if extra_headers:
            for k, v in extra_headers.items():
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.end_headers()

    def get_auth_user(self):
        auth_header = self.headers.get("Authorization", "")
        token = ""
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
        
        # Also check cookie
        if not token and "Cookie" in self.headers:
            cookies = self.headers["Cookie"].split(";")
            for c in cookies:
                c = c.strip()
                if c.startswith("xyz_session="):
                    token = c.split("=")[1]
                    break

        if not token:
            return None

        conn = get_db()
        c = conn.cursor()
        c.execute("""
            SELECT u.id, u.name, u.email, u.role, u.phone, u.address
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ?
        """, (token,))
        user = c.fetchone()
        conn.close()
        return dict(user) if user else None

    def read_json_body(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 0:
                raw_data = self.rfile.read(content_length)
                return json.loads(raw_data.decode('utf-8'))
            return {}
        except Exception:
            return {}

    # Router logic
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # API Routes
        if path.startswith("/api/"):
            return self.handle_api_get(path, query)

        # Static File Serving
        return self.handle_static_files(path)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path.startswith("/api/"):
            return self.handle_api_post(path)
        self.send_json({"error": "Not Found"}, status_code=404)

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path.startswith("/api/"):
            return self.handle_api_put(path)
        self.send_json({"error": "Not Found"}, status_code=404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path.startswith("/api/"):
            return self.handle_api_delete(path)
        self.send_json({"error": "Not Found"}, status_code=404)

    # --------------------- API HANDLERS ---------------------

    def handle_api_get(self, path, query):
        conn = get_db()
        c = conn.cursor()

        # 1. Config / Branding
        if path == "/api/config":
            c.execute("SELECT key, value FROM config")
            rows = c.fetchall()
            conn.close()
            return self.send_json({r["key"]: r["value"] for r in rows})

        # 2. Auth Status
        elif path == "/api/auth/me":
            user = self.get_auth_user()
            conn.close()
            if user:
                return self.send_json({"user": user})
            return self.send_json({"user": None})

        # 3. Categories
        elif path == "/api/categories":
            c.execute("SELECT * FROM categories ORDER BY display_order ASC")
            categories = [dict(r) for r in c.fetchall()]
            conn.close()
            return self.send_json(categories)

        # 4. Menu Items
        elif path == "/api/menu":
            category = query.get("category", ["all"])[0]
            is_veg = query.get("veg", [None])[0]
            search = query.get("search", [""])[0].strip()

            sql = """
                SELECT m.*, c.name as category_name, c.slug as category_slug
                FROM menu_items m
                JOIN categories c ON m.category_id = c.id
                WHERE 1=1
            """
            params = []

            if category and category != "all":
                sql += " AND c.slug = ?"
                params.append(category)

            if is_veg == "1":
                sql += " AND m.is_veg = 1"

            if search:
                sql += " AND (m.name LIKE ? OR m.description LIKE ?)"
                params.extend([f"%{search}%", f"%{search}%"])

            sql += " ORDER BY m.is_bestseller DESC, m.id DESC"
            c.execute(sql, params)
            items = [dict(r) for r in c.fetchall()]
            conn.close()
            return self.send_json(items)

        # 5. Coupons & Offers
        elif path == "/api/coupons":
            active_only = query.get("active", ["1"])[0]
            if active_only == "1":
                c.execute("SELECT * FROM coupons WHERE is_active = 1 ORDER BY min_order_amount ASC")
            else:
                c.execute("SELECT * FROM coupons ORDER BY id DESC")
            coupons = [dict(r) for r in c.fetchall()]
            conn.close()
            return self.send_json(coupons)

        # 6. Orders
        elif path == "/api/orders":
            user = self.get_auth_user()
            if not user:
                conn.close()
                return self.send_json({"error": "Unauthorized"}, status_code=401)

            if user["role"] == "admin":
                c.execute("SELECT * FROM orders ORDER BY id DESC")
            else:
                c.execute("SELECT * FROM orders WHERE user_id = ? OR customer_email = ? ORDER BY id DESC", 
                          (user["id"], user["email"]))
            
            orders = []
            for r in c.fetchall():
                ord_dict = dict(r)
                try:
                    ord_dict["items"] = json.loads(ord_dict["items_json"])
                except Exception:
                    ord_dict["items"] = []
                orders.append(ord_dict)

            conn.close()
            return self.send_json(orders)

        # 7. Single Order (Tracking)
        elif path.startswith("/api/orders/"):
            order_number = path.split("/api/orders/")[1]
            c.execute("SELECT * FROM orders WHERE order_number = ?", (order_number,))
            row = c.fetchone()
            conn.close()
            if not row:
                return self.send_json({"error": "Order not found"}, status_code=404)
            ord_dict = dict(row)
            try:
                ord_dict["items"] = json.loads(ord_dict["items_json"])
            except Exception:
                ord_dict["items"] = []
            return self.send_json(ord_dict)

        # 8. Reservations
        elif path == "/api/reservations":
            user = self.get_auth_user()
            if not user:
                conn.close()
                return self.send_json({"error": "Unauthorized"}, status_code=401)

            if user["role"] == "admin":
                c.execute("SELECT * FROM reservations ORDER BY reservation_date DESC, reservation_time DESC")
            else:
                c.execute("SELECT * FROM reservations WHERE user_id = ? OR guest_email = ? ORDER BY id DESC",
                          (user["id"], user["email"]))
            
            reservations = [dict(r) for r in c.fetchall()]
            conn.close()
            return self.send_json(reservations)

        # 9. Admin Stats Overview
        elif path == "/api/stats":
            user = self.get_auth_user()
            if not user or user["role"] != "admin":
                conn.close()
                return self.send_json({"error": "Forbidden: Admin access required"}, status_code=403)

            total_revenue = c.execute("SELECT COALESCE(SUM(grand_total), 0) as rev FROM orders WHERE order_status != 'Cancelled'").fetchone()["rev"]
            total_orders = c.execute("SELECT COUNT(*) as count FROM orders").fetchone()["count"]
            pending_orders = c.execute("SELECT COUNT(*) as count FROM orders WHERE order_status IN ('Placed', 'Preparing', 'Out for Delivery')").fetchone()["count"]
            total_items = c.execute("SELECT COUNT(*) as count FROM menu_items").fetchone()["count"]
            total_reservations = c.execute("SELECT COUNT(*) as count FROM reservations").fetchone()["count"]
            pending_reservations = c.execute("SELECT COUNT(*) as count FROM reservations WHERE status = 'Pending'").fetchone()["count"]

            conn.close()
            return self.send_json({
                "total_revenue": round(total_revenue, 2),
                "total_orders": total_orders,
                "pending_orders": pending_orders,
                "total_items": total_items,
                "total_reservations": total_reservations,
                "pending_reservations": pending_reservations
            })

        conn.close()
        return self.send_json({"error": "API route not found"}, status_code=404)

    def handle_api_post(self, path):
        body = self.read_json_body()
        conn = get_db()
        c = conn.cursor()

        # 1. Register User
        if path == "/api/auth/register":
            name = body.get("name", "").strip()
            email = body.get("email", "").strip().lower()
            password = body.get("password", "")
            phone = body.get("phone", "").strip()
            address = body.get("address", "").strip()

            if not name or not email or not password:
                conn.close()
                return self.send_json({"error": "Name, email, and password are required"}, status_code=400)

            c.execute("SELECT id FROM users WHERE email = ?", (email,))
            if c.fetchone():
                conn.close()
                return self.send_json({"error": "Email is already registered. Please login."}, status_code=409)

            hashed = hash_password(password)
            c.execute("""
                INSERT INTO users (name, email, password_hash, role, phone, address)
                VALUES (?, ?, ?, 'customer', ?, ?)
            """, (name, email, hashed, phone, address))
            user_id = c.lastrowid

            token = secrets.token_hex(24)
            c.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id))
            conn.commit()

            user_data = {"id": user_id, "name": name, "email": email, "role": "customer", "phone": phone, "address": address}
            conn.close()
            return self.send_json({
                "message": "Account created successfully",
                "user": user_data,
                "token": token
            }, extra_headers={"Set-Cookie": f"xyz_session={token}; Path=/; HttpOnly; SameSite=Lax"})

        # 2. Login User
        elif path == "/api/auth/login":
            email = body.get("email", "").strip().lower()
            password = body.get("password", "")

            c.execute("SELECT * FROM users WHERE email = ?", (email,))
            user = c.fetchone()

            if not user or not verify_password(user["password_hash"], password):
                conn.close()
                return self.send_json({"error": "Invalid email or password"}, status_code=401)

            token = secrets.token_hex(24)
            c.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user["id"]))
            conn.commit()

            user_data = {
                "id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role": user["role"],
                "phone": user["phone"],
                "address": user["address"]
            }
            conn.close()
            return self.send_json({
                "message": "Logged in successfully",
                "user": user_data,
                "token": token
            }, extra_headers={"Set-Cookie": f"xyz_session={token}; Path=/; HttpOnly; SameSite=Lax"})

        # 3. Logout
        elif path == "/api/auth/logout":
            token = ""
            auth_header = self.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
            if not token and "Cookie" in self.headers:
                for cookie in self.headers["Cookie"].split(";"):
                    if cookie.strip().startswith("xyz_session="):
                        token = cookie.strip().split("=")[1]
            if token:
                c.execute("DELETE FROM sessions WHERE token = ?", (token,))
                conn.commit()
            conn.close()
            return self.send_json({"message": "Logged out successfully"},
                                  extra_headers={"Set-Cookie": "xyz_session=; Path=/; Max-Age=0"})

        # 4. Place Order (Zomato/Swiggy checkout)
        elif path == "/api/orders":
            user = self.get_auth_user()
            items = body.get("items", [])
            customer_name = body.get("customer_name", "").strip() or (user["name"] if user else "Guest Customer")
            customer_phone = body.get("customer_phone", "").strip() or (user["phone"] if user else "")
            customer_email = body.get("customer_email", "").strip() or (user["email"] if user else "")
            delivery_address = body.get("delivery_address", "").strip()
            order_type = body.get("order_type", "delivery")
            coupon_code = body.get("coupon_code", "").strip().upper()
            special_instructions = body.get("special_instructions", "")
            payment_method = body.get("payment_method", "Cash on Delivery")

            if not items:
                conn.close()
                return self.send_json({"error": "Your cart is empty"}, status_code=400)

            if not delivery_address and order_type == "delivery":
                conn.close()
                return self.send_json({"error": "Please provide a delivery address"}, status_code=400)

            # Calculate Subtotal
            subtotal = sum(item.get("price", 0) * item.get("quantity", 1) for item in items)
            discount_amount = 0

            # Validate Coupon if provided
            if coupon_code:
                c.execute("SELECT * FROM coupons WHERE code = ? AND is_active = 1", (coupon_code,))
                coupon = c.fetchone()
                if coupon and subtotal >= coupon["min_order_amount"]:
                    if coupon["discount_type"] == "percentage":
                        calc = (subtotal * coupon["discount_value"]) / 100.0
                        discount_amount = min(calc, coupon["max_discount"]) if coupon["max_discount"] > 0 else calc
                    else:
                        discount_amount = min(coupon["discount_value"], subtotal)

            # Charges
            delivery_fee = 0 if (order_type != "delivery" or subtotal >= 499 or coupon_code == "FREEDEL") else 40
            taxes = round(subtotal * 0.05, 2) # 5% GST
            packaging_fee = 25 if order_type == "delivery" else 0
            grand_total = round(max(0, subtotal - discount_amount + delivery_fee + taxes + packaging_fee), 2)

            order_number = f"XYZ-{datetime.now().strftime('%y%m%d')}-{secrets.randbelow(8999) + 1000}"

            c.execute("""
                INSERT INTO orders (
                    order_number, user_id, customer_name, customer_phone, customer_email,
                    delivery_address, order_type, items_json, subtotal, discount_amount,
                    coupon_code, delivery_fee, taxes, packaging_fee, grand_total,
                    payment_method, payment_status, order_status, special_instructions
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Placed', ?)
            """, (
                order_number, user["id"] if user else None, customer_name, customer_phone, customer_email,
                delivery_address, order_type, json.dumps(items), subtotal, discount_amount,
                coupon_code, delivery_fee, taxes, packaging_fee, grand_total,
                payment_method, 'Paid' if payment_method in ['UPI', 'Card'] else 'Pending',
                special_instructions
            ))
            order_id = c.lastrowid
            conn.commit()
            conn.close()

            return self.send_json({
                "message": "Order placed successfully! Chef has received your order.",
                "order_id": order_id,
                "order_number": order_number,
                "grand_total": grand_total,
                "estimated_time": "30-35 mins"
            })

        # 5. Book Table Reservation
        elif path == "/api/reservations":
            user = self.get_auth_user()
            guest_name = body.get("guest_name", "").strip() or (user["name"] if user else "")
            guest_email = body.get("guest_email", "").strip() or (user["email"] if user else "")
            guest_phone = body.get("guest_phone", "").strip() or (user["phone"] if user else "")
            reservation_date = body.get("reservation_date", "")
            reservation_time = body.get("reservation_time", "")
            guest_count = int(body.get("guest_count", 2))
            seating_preference = body.get("seating_preference", "Standard Dining")
            special_requests = body.get("special_requests", "")

            if not guest_name or not guest_phone or not reservation_date or not reservation_time:
                conn.close()
                return self.send_json({"error": "Please fill in all reservation details (name, phone, date, time)."}, status_code=400)

            c.execute("""
                INSERT INTO reservations (
                    user_id, guest_name, guest_email, guest_phone, reservation_date,
                    reservation_time, guest_count, seating_preference, special_requests, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed')
            """, (user["id"] if user else None, guest_name, guest_email, guest_phone,
                  reservation_date, reservation_time, guest_count, seating_preference, special_requests))
            res_id = c.lastrowid
            conn.commit()
            conn.close()

            return self.send_json({
                "message": "Table reserved successfully! A confirmation SMS/Email has been sent.",
                "reservation_id": res_id
            })

        # 6. Admin: Add New Menu Item
        elif path == "/api/menu":
            user = self.get_auth_user()
            if not user or user["role"] != "admin":
                conn.close()
                return self.send_json({"error": "Forbidden: Admin access required"}, status_code=403)

            name = body.get("name", "").strip()
            category_id = int(body.get("category_id", 1))
            description = body.get("description", "").strip()
            price = float(body.get("price", 0))
            original_price = float(body.get("original_price", price * 1.25))
            image_url = body.get("image_url", "").strip() or "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80"
            is_veg = 1 if body.get("is_veg", True) else 0
            is_bestseller = 1 if body.get("is_bestseller", False) else 0
            spice_level = int(body.get("spice_level", 1))
            preparation_time = body.get("preparation_time", "20-25 mins")

            if not name or price <= 0:
                conn.close()
                return self.send_json({"error": "Dish name and valid price are required"}, status_code=400)

            has_half_full = 1 if body.get("has_half_full") else 0
            half_price = float(body.get("half_price", price))
            full_price = float(body.get("full_price", price))

            c.execute("""
                INSERT INTO menu_items (
                    category_id, name, description, price, original_price, image_url,
                    is_veg, is_bestseller, is_available, spice_level, preparation_time,
                    has_half_full, half_price, full_price
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
            """, (category_id, name, description, price, original_price, image_url, is_veg, is_bestseller, spice_level, preparation_time, has_half_full, half_price, full_price))
            item_id = c.lastrowid
            conn.commit()
            conn.close()
            return self.send_json({"message": "Menu item added successfully", "id": item_id})

        # 7. Admin: Add Coupon / Promo Code
        elif path == "/api/coupons":
            user = self.get_auth_user()
            if not user or user["role"] != "admin":
                conn.close()
                return self.send_json({"error": "Forbidden: Admin access required"}, status_code=403)

            code = body.get("code", "").strip().upper()
            title = body.get("title", "").strip()
            description = body.get("description", "").strip()
            discount_type = body.get("discount_type", "percentage")
            discount_value = float(body.get("discount_value", 10))
            max_discount = float(body.get("max_discount", 0))
            min_order_amount = float(body.get("min_order_amount", 199))

            if not code or discount_value <= 0:
                conn.close()
                return self.send_json({"error": "Coupon code and discount value are required"}, status_code=400)

            try:
                c.execute("""
                    INSERT INTO coupons (code, title, description, discount_type, discount_value, max_discount, min_order_amount, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                """, (code, title, description, discount_type, discount_value, max_discount, min_order_amount))
                coupon_id = c.lastrowid
                conn.commit()
                conn.close()
                return self.send_json({"message": f"Coupon {code} created successfully", "id": coupon_id})
            except sqlite3.IntegrityError:
                conn.close()
                return self.send_json({"error": f"Coupon code '{code}' already exists"}, status_code=409)

        # 8. Admin: Update Restaurant Config / Name
        elif path == "/api/config":
            user = self.get_auth_user()
            if not user or user["role"] != "admin":
                conn.close()
                return self.send_json({"error": "Forbidden: Admin access required"}, status_code=403)

            for key, val in body.items():
                c.execute("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)", (key, str(val)))
            conn.commit()
            conn.close()
            return self.send_json({"message": "Restaurant settings updated successfully"})

        conn.close()
        return self.send_json({"error": "Invalid POST route"}, status_code=404)

    def handle_api_put(self, path):
        body = self.read_json_body()
        conn = get_db()
        c = conn.cursor()

        # 1. Admin: Edit Menu Item (Price, Photo, Availability, etc.)
        if path.startswith("/api/menu/"):
            user = self.get_auth_user()
            if not user or user["role"] != "admin":
                conn.close()
                return self.send_json({"error": "Forbidden: Admin access required"}, status_code=403)

            item_id = int(path.split("/api/menu/")[1])
            c.execute("SELECT * FROM menu_items WHERE id = ?", (item_id,))
            current = c.fetchone()
            if not current:
                conn.close()
                return self.send_json({"error": "Menu item not found"}, status_code=404)

            name = body.get("name", current["name"])
            category_id = body.get("category_id", current["category_id"])
            description = body.get("description", current["description"])
            price = float(body.get("price", current["price"]))
            original_price = float(body.get("original_price", current["original_price"]))
            image_url = body.get("image_url", current["image_url"])
            is_veg = int(body.get("is_veg", current["is_veg"]))
            is_bestseller = int(body.get("is_bestseller", current["is_bestseller"]))
            is_available = int(body.get("is_available", current["is_available"]))

            has_half_full = int(body.get("has_half_full", current["has_half_full"] if "has_half_full" in current.keys() else 0))
            half_price = float(body.get("half_price", current["half_price"] if "half_price" in current.keys() else price))
            full_price = float(body.get("full_price", current["full_price"] if "full_price" in current.keys() else price))

            c.execute("""
                UPDATE menu_items
                SET name = ?, category_id = ?, description = ?, price = ?,
                    original_price = ?, image_url = ?, is_veg = ?,
                    is_bestseller = ?, is_available = ?,
                    has_half_full = ?, half_price = ?, full_price = ?
                WHERE id = ?
            """, (name, category_id, description, price, original_price, image_url, is_veg, is_bestseller, is_available, has_half_full, half_price, full_price, item_id))
            conn.commit()
            conn.close()
            return self.send_json({"message": f"Menu item '{name}' updated successfully"})

        # 2. Admin: Update Order Status
        elif path.startswith("/api/orders/") and path.endswith("/status"):
            user = self.get_auth_user()
            if not user or user["role"] != "admin":
                conn.close()
                return self.send_json({"error": "Forbidden: Admin access required"}, status_code=403)

            order_id = path.split("/api/orders/")[1].split("/status")[0]
            status = body.get("status", "Placed")
            c.execute("UPDATE orders SET order_status = ? WHERE id = ? OR order_number = ?", (status, order_id, order_id))
            conn.commit()
            conn.close()
            return self.send_json({"message": f"Order status updated to {status}"})

        # 3. Admin: Update Reservation Status
        elif path.startswith("/api/reservations/") and path.endswith("/status"):
            user = self.get_auth_user()
            if not user or user["role"] != "admin":
                conn.close()
                return self.send_json({"error": "Forbidden: Admin access required"}, status_code=403)

            res_id = int(path.split("/api/reservations/")[1].split("/status")[0])
            status = body.get("status", "Confirmed")
            c.execute("UPDATE reservations SET status = ? WHERE id = ?", (status, res_id))
            conn.commit()
            conn.close()
            return self.send_json({"message": f"Reservation updated to {status}"})

        # 4. Admin: Toggle Coupon Active
        elif path.startswith("/api/coupons/") and path.endswith("/toggle"):
            user = self.get_auth_user()
            if not user or user["role"] != "admin":
                conn.close()
                return self.send_json({"error": "Forbidden: Admin access required"}, status_code=403)

            coupon_id = int(path.split("/api/coupons/")[1].split("/toggle")[0])
            c.execute("UPDATE coupons SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?", (coupon_id,))
            conn.commit()
            conn.close()
            return self.send_json({"message": "Coupon status toggled"})

        conn.close()
        return self.send_json({"error": "Invalid PUT route"}, status_code=404)

    def handle_api_delete(self, path):
        user = self.get_auth_user()
        if not user or user["role"] != "admin":
            return self.send_json({"error": "Forbidden: Admin access required"}, status_code=403)

        conn = get_db()
        c = conn.cursor()

        # Delete menu item
        if path.startswith("/api/menu/"):
            item_id = int(path.split("/api/menu/")[1])
            c.execute("DELETE FROM menu_items WHERE id = ?", (item_id,))
            conn.commit()
            conn.close()
            return self.send_json({"message": "Dish removed from menu"})

        # Delete coupon
        elif path.startswith("/api/coupons/"):
            coupon_id = int(path.split("/api/coupons/")[1])
            c.execute("DELETE FROM coupons WHERE id = ?", (coupon_id,))
            conn.commit()
            conn.close()
            return self.send_json({"message": "Coupon deleted"})

        conn.close()
        return self.send_json({"error": "Invalid DELETE route"}, status_code=404)

    # --------------------- STATIC FILE SERVING ---------------------

    def handle_static_files(self, path):
        if path == "/" or path == "":
            path = "/index.html"

        # Sanitize path
        rel_path = path.lstrip("/")
        full_path = os.path.normpath(os.path.join(PUBLIC_DIR, rel_path))

        # Security check: ensure path is inside PUBLIC_DIR
        if not full_path.startswith(PUBLIC_DIR):
            self.send_response(403)
            self.end_headers()
            return

        if os.path.isdir(full_path):
            full_path = os.path.join(full_path, "index.html")

        if not os.path.exists(full_path) or not os.path.isfile(full_path):
            # Fallback to index.html for client side routing
            index_path = os.path.join(PUBLIC_DIR, "index.html")
            if os.path.exists(index_path):
                full_path = index_path
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"wait until server works")
                return

        mime_type, _ = mimetypes.guess_type(full_path)
        if not mime_type:
            mime_type = "application/octet-stream"

        try:
            with open(full_path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(f"500 Internal Server Error: {e}".encode())

def run_server(preferred_port=None):
    init_db()
    ports_to_try = [preferred_port] if preferred_port else [PORT, 8080, 8888, 3001]
    ports_to_try = [p for p in ports_to_try if p]
    httpd = None
    active_port = None

    for p in ports_to_try:
        try:
            server_address = ('', p)
            httpd = HTTPServer(server_address, RestaurantRequestHandler)
            active_port = p
            break
        except OSError:
            continue

    if not httpd:
        print("❌ Could not bind to any available port (tried:", ports_to_try, ")")
        return

    print("=" * 60)
    print(f"🚀 THE SECOND WIFE FAMILY RESTAURANT Web Server running at: http://localhost:{active_port}")
    print(f"👤 Customer Demo Login:  customer@xyz.com | customer123")
    print(f"👑 Admin Portal Login:    admin@xyz.com    | admin123")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Shutting down server gracefully...")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
