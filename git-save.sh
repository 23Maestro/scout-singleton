#!/bin/bash

# Simple Git Save Script for scout-singleton
# Usage: ./git-save.sh "your commit message"

echo "🔄 Saving your code to GitHub..."

# Check if a commit message was provided
if [ -z "$1" ]; then
    echo "❌ Please provide a commit message:"
    echo "   ./git-save.sh \"your message here\""
    exit 1
fi

# Show what files have changed
echo "📄 Files that will be saved:"
git status --porcelain

# Ask for confirmation
echo ""
read -p "👆 Save these changes? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Add all changes
    git add -A
    
    # Commit with the provided message
    git commit -m "$1"
    
    # Push to GitHub
    git push
    
    echo "✅ Code saved to GitHub successfully!"
    echo "🔗 View at: https://github.com/23Maestro/scout-singleton"
else
    echo "❌ Save cancelled."
fi
