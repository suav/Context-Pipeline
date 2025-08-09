#!/bin/bash

# Chrome Installation Script for Context Pipeline
# This script installs Google Chrome or Chromium for Puppeteer testing

echo "🚀 Installing Chrome/Chromium for Context Pipeline..."

# Function to detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            OS=$NAME
            VER=$VERSION_ID
        fi
        echo "Detected OS: $OS"
    else
        echo "❌ This script is designed for Linux systems"
        exit 1
    fi
}

# Function to install Chrome on Ubuntu/Debian
install_chrome_debian() {
    echo "📦 Installing Google Chrome on Ubuntu/Debian..."
    
    # Update package list
    sudo apt-get update
    
    # Install prerequisites
    sudo apt-get install -y wget gnupg
    
    # Add Google's signing key
    wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
    
    # Add Chrome repository
    echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
    
    # Update package list
    sudo apt-get update
    
    # Install Chrome
    sudo apt-get install -y google-chrome-stable
    
    # Verify installation
    if command -v google-chrome &> /dev/null; then
        echo "✅ Google Chrome installed successfully!"
        google-chrome --version
    else
        echo "❌ Chrome installation failed, trying Chromium..."
        install_chromium_debian
    fi
}

# Function to install Chromium on Ubuntu/Debian
install_chromium_debian() {
    echo "📦 Installing Chromium on Ubuntu/Debian..."
    
    sudo apt-get update
    sudo apt-get install -y chromium-browser
    
    # Verify installation
    if command -v chromium-browser &> /dev/null; then
        echo "✅ Chromium installed successfully!"
        chromium-browser --version
    else
        echo "❌ Chromium installation failed"
        exit 1
    fi
}

# Function to install Chrome on CentOS/RHEL/Fedora
install_chrome_redhat() {
    echo "📦 Installing Google Chrome on CentOS/RHEL/Fedora..."
    
    # Create repo file
    sudo tee /etc/yum.repos.d/google-chrome.repo <<EOF
[google-chrome]
name=google-chrome
baseurl=http://dl.google.com/linux/chrome/rpm/stable/x86_64
enabled=1
gpgcheck=1
gpgkey=https://dl.google.com/linux/linux_signing_key.pub
EOF
    
    # Install Chrome
    if command -v dnf &> /dev/null; then
        sudo dnf install -y google-chrome-stable
    else
        sudo yum install -y google-chrome-stable
    fi
    
    # Verify installation
    if command -v google-chrome &> /dev/null; then
        echo "✅ Google Chrome installed successfully!"
        google-chrome --version
    else
        echo "❌ Chrome installation failed"
        exit 1
    fi
}

# Function to test browser with Puppeteer
test_browser() {
    echo "🧪 Testing browser with Puppeteer..."
    
    # Change to project directory
    cd "$(dirname "$0")/.."
    
    # Test Puppeteer
    node scripts/setup-puppeteer-testing.js
    
    if [ $? -eq 0 ]; then
        echo "✅ Puppeteer testing successful!"
    else
        echo "⚠️  Puppeteer testing failed, but browser is installed"
        echo "   You can still run browser-free tests: node scripts/test-comprehensive.js"
    fi
}

# Main installation flow
main() {
    detect_os
    
    case "$OS" in
        "Ubuntu"*|"Debian"*)
            echo "🎯 Detected Ubuntu/Debian system"
            echo "Choose installation option:"
            echo "1) Google Chrome (recommended)"
            echo "2) Chromium (open source)"
            read -p "Enter choice (1 or 2): " choice
            
            case $choice in
                1) install_chrome_debian ;;
                2) install_chromium_debian ;;
                *) 
                    echo "Invalid choice, installing Chrome..."
                    install_chrome_debian 
                    ;;
            esac
            ;;
        "CentOS"*|"Red Hat"*|"Fedora"*)
            install_chrome_redhat
            ;;
        *)
            echo "❌ Unsupported OS: $OS"
            echo "Please install Chrome/Chromium manually:"
            echo "- Chrome: https://www.google.com/chrome/"
            echo "- Chromium: Use your system's package manager"
            exit 1
            ;;
    esac
    
    # Test the installation
    test_browser
}

# Run main function
main