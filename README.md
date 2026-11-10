# 🍽️ THE SECOND WIFE FAMILY RESTAURANT - Fullstack Web Platform

A production-grade, responsive restaurant web application featuring **Zomato & Swiggy inspired online food ordering, discounts/offers carousel, table reservations, live order status tracking, user authentication, and a powerful Admin Management Portal**.

Built with standard **Python 3** and modern frontend technologies (**Tailwind CSS, Vanilla JS, SQLite**), requiring **ZERO external pip or npm dependencies**. It runs immediately on any Mac, Windows, or Linux system out of the box!

---

## 🚀 Quick Start (Running the Website)

Open your terminal in this directory and run:

```bash
python3 server.py
```
*(Or execute `./run.sh`)*

Then open your browser and navigate to:
👉 **[http://localhost:8000](http://localhost:8000)** (or port 8080 if 8000 is occupied)

---

## 🔑 Login Accounts (Demo Credentials)

| Role | Email | Password | Access & Capabilities |
|---|---|---|---|
| **Admin** | `admin@xyz.com` | `admin123` | Full Admin Dashboard: Edit food prices & photos live, add/delete dishes, manage promo codes, change order statuses, manage table reservations, and edit restaurant name/branding |
| **Customer** | `customer@xyz.com` | `customer123` | Place food orders, apply coupons, book dining tables, live track deliveries, view order history |

> **Note**: You can also register any new customer account with your own email and password via the "Sign In / Register" button on the top right.

---

## 👑 Admin Features (How to Edit Prices, Pics & Discounts)

1. Sign in with `admin@xyz.com` / `admin123` (or click the **"👑 Demo Admin"** 1-click button on the login modal).
2. Click **"👑 Admin Portal"** in the top navigation or visit **`http://localhost:8000/admin.html`**.
3. In the Admin Dashboard:
   - **🍲 Edit Prices & Food Photos**: Click the blue **"✏️ Edit Price & Pic"** button next to any dish in the Menu Editor tab. You can update the selling price (₹), original strikethrough price, and paste any image URL with an instant live image preview.
   - **🔴 In Stock / Sold Out Toggle**: Toggle any item from *In Stock* to *Sold Out* with a single click.
   - **➕ Add New Dishes**: Click `+ Add New Dish` to add dishes with categories, custom prep times, spice meters, and bestseller ribbons.
   - **🏷️ Discounts & Promo Codes**: Go to the **"Discounts & Coupons"** tab to create promo codes like `XYZ50`, `WELCOME20`, `TASTY100`, specify percentage discounts (e.g. 50% up to ₹150) or flat deductions, and set minimum order amounts.
   - **📦 Live Kitchen Orders**: Track incoming orders and advance their statuses from `📝 Placed` ➔ `👨‍🍳 Preparing` ➔ `🛵 Out for Delivery` ➔ `🎉 Delivered`.
   - **🍽️ Table Reservations**: View guest names, contact numbers, party sizes, seating preferences (e.g., Candlelight booth, Window seat), and update reservation status.
   - **⚙️ Restaurant Name & Branding**: Open the **"Restaurant Settings"** tab to rename `"THE SECOND WIFE FAMILY RESTAURANT"` to your official restaurant name (e.g. *"2nd Wife"*), change phone numbers, addresses, delivery fees, and tax rates.

---

## 🍕 Customer Features (Zomato & Swiggy Experience)

- **Search & Quick Cuisine Circles**: Filter by Biryani & Rice, Pizzas & Pastas, Burgers & Rolls, Starters & Tandoor, North Indian Curries, Desserts, and Shakes.
- **Pure Veg & Bestseller Toggles**: Switch between Pure Veg dishes (green square icon) and non-veg with authentic Indian food indicators.
- **Promo Carousel**: One-click apply for active coupons (`XYZ50`, `WELCOME20`, `FREEDEL`, `TASTY100`).
- **Interactive Sliding Cart**:
  - Toggle between **🛵 Delivery** (with address) and **🛍️ Takeaway / Pickup**.
  - Dynamic bill calculation: Item Total, Coupon Discount (green deduction), Delivery Fee (free above ₹499), GST Taxes (5%), Packaging Charge, and Grand Total.
  - Payment modes: Cash on Delivery, Instant UPI (GPay/PhonePe), Credit/Debit Card.
- **Real-Time Live Order Tracker**:
  - Live progress stepper: `Placed` ➔ `Kitchen Cooking` ➔ `Valet On the Way` ➔ `Delivered` with live countdown ETA timer.
- **Table Reservation System**:
  - Select date, lunch/dinner time slots, guest count (1 to 8+), seating preference, and special requests (e.g. Anniversary / Birthday).

---

## 📁 Project Directory Structure

```text
├── server.py             # Python HTTP server with REST APIs, SQLite DB & Session Auth
├── restaurant.db         # Persistent SQLite database (initialized automatically)
├── run.sh                # Executable startup shell script
├── README.md             # Complete documentation
└── public/
    ├── index.html        # Customer storefront Single Page App (Zomato/Swiggy UI)
    ├── admin.html        # Dedicated Admin Management Portal
    ├── css/
    │   └── style.css     # Tailored styles, Veg/Non-Veg badges, animations & toast UI
    ├── js/
    │   ├── app.js        # Storefront state, cart, offers, order tracking & auth
    │   └── admin.js      # Admin CRUD logic, price/pic live editor, order pipeline
    └── images/           # Assets directory
```

---

## 🛠️ Modifying the Restaurant Name in Code

The restaurant name is centralized and can be edited in two ways:
1. **Via UI**: In the Admin Dashboard under **"Restaurant Settings"** (saves into `restaurant.db` permanently).
2. **Via Code**: Change the default name `"THE SECOND WIFE FAMILY RESTAURANT"` in `server.py` inside `default_configs`.
