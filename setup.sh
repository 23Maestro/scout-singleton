#!/bin/bash
# Scout Singleton Raycast Extension Setup Script

echo "🏈 Setting up Scout Singleton Raycast Extension..."

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed. Please install Python 3 first."
    exit 1
fi

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 is required but not installed. Please install pip first."
    exit 1
fi

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip3 install -r requirements.txt

# Make Python scripts executable
echo "🔧 Making Python scripts executable..."
chmod +x scripts/*.py

# Check if Chrome is installed (required for Selenium)
if [ ! -d "/Applications/Google Chrome.app" ]; then
    echo "⚠️  Google Chrome not found. Selenium automation requires Chrome."
    echo "   Please install Chrome from: https://www.google.com/chrome/"
else
    echo "✅ Chrome found"
fi

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Configure Asana OAuth in Raycast preferences"
echo "   2. Add NPID API key in extension preferences"
echo "   3. Run 'npm run dev' to start development"
echo ""
echo "🚀 Available commands:"
echo "   • id-tasks: View and manage video editing tasks"
echo "   • inbox-check: Check video team inbox for new assignments"
echo "   • player-lookup: Find player details via Selenium automation"
echo "   • sync-status: Sync Asana status back to NPID"