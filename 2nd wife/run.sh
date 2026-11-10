#!/bin/bash
# Restaurant THE SECOND WIFE FAMILY RESTAURANT - Startup Script
echo "=========================================================="
echo " Starting THE SECOND WIFE FAMILY RESTAURANT Web Platform..."
echo "=========================================================="

# Check if python3 is available
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is required but not found. Please install Python 3."
    exit 1
fi

# Run the server
python3 server.py
