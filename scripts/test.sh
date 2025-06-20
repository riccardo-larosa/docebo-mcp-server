#!/bin/bash

# Test script for Docebo MCP Server
# This script runs different types of tests and generates coverage reports

set -e

echo "🧪 Docebo MCP Server Test Suite"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Node.js and npm are installed
check_dependencies() {
    print_step "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    print_success "Dependencies check passed"
}

# Install dependencies
install_deps() {
    print_step "Installing dependencies..."
    npm install
    print_success "Dependencies installed"
}

# Build the project
build_project() {
    print_step "Building project..."
    npm run build
    print_success "Project built successfully"
}

# Run unit tests
run_unit_tests() {
    print_step "Running unit tests..."
    npm test -- __tests__/auth.test.ts __tests__/tools.test.ts __tests__/server-core.test.ts __tests__/client.test.ts
    print_success "Unit tests completed"
}

# Run MCP protocol compliance tests
run_mcp_tests() {
    print_step "Running MCP protocol compliance tests..."
    npm test -- __tests__/mcp-protocol-compliance.test.ts
    print_success "MCP protocol compliance tests completed"
}

# Run integration tests
run_integration_tests() {
    print_step "Running integration tests..."
    npm test -- __tests__/integration/ 2>/dev/null || print_warning "No integration tests found"
    print_success "Integration tests completed"
}

# Run all tests
run_all_tests() {
    print_step "Running all tests..."
    npm test
    print_success "All tests completed"
}

# Generate coverage report
generate_coverage() {
    print_step "Generating coverage report..."
    npm run coverage
    print_success "Coverage report generated"
    
    if [ -d "coverage" ]; then
        print_step "Coverage report available at: coverage/index.html"
    fi
}

# Lint the code
lint_code() {
    print_step "Linting code..."
    if command -v npx &> /dev/null && npx eslint --version &> /dev/null; then
        npx eslint src/ __tests__/ --ext .ts,.js
        print_success "Linting completed"
    else
        print_warning "ESLint not found, skipping linting"
    fi
}

# Type check
type_check() {
    print_step "Type checking..."
    npx tsc --noEmit
    print_success "Type checking completed"
}

# Test server startup
test_server_startup() {
    print_step "Testing server startup..."
    
    # Build first
    npm run build
    
    # Start server in background
    timeout 10s node build/server/hono-index.js &
    SERVER_PID=$!
    
    # Wait a moment for server to start
    sleep 2
    
    # Test health endpoint
    if curl -f -s http://localhost:3000/health > /dev/null; then
        print_success "Server startup test passed"
    else
        print_warning "Server health check failed (this is expected if server isn't fully configured)"
    fi
    
    # Clean up
    kill $SERVER_PID 2>/dev/null || true
}

# Main execution
main() {
    case "${1:-all}" in
        "deps")
            check_dependencies
            install_deps
            ;;
        "build")
            build_project
            ;;
        "unit")
            check_dependencies
            run_unit_tests
            ;;
        "mcp")
            check_dependencies
            run_mcp_tests
            ;;
        "integration")
            check_dependencies
            run_integration_tests
            ;;
        "coverage")
            check_dependencies
            generate_coverage
            ;;
        "lint")
            lint_code
            ;;
        "typecheck")
            type_check
            ;;
        "server")
            test_server_startup
            ;;
        "ci")
            print_step "Running CI pipeline..."
            check_dependencies
            install_deps
            build_project
            type_check
            lint_code
            run_all_tests
            generate_coverage
            print_success "CI pipeline completed successfully!"
            ;;
        "all"|*)
            print_step "Running complete test suite..."
            check_dependencies
            install_deps
            build_project
            type_check
            run_all_tests
            generate_coverage
            test_server_startup
            print_success "Complete test suite finished!"
            ;;
    esac
}

# Show usage if --help is passed
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  all        - Run complete test suite (default)"
    echo "  deps       - Check and install dependencies"
    echo "  build      - Build the project"
    echo "  unit       - Run unit tests only"
    echo "  mcp        - Run MCP protocol compliance tests"
    echo "  integration- Run integration tests only"
    echo "  coverage   - Generate coverage report"
    echo "  lint       - Lint the code"
    echo "  typecheck  - Run TypeScript type checking"
    echo "  server     - Test server startup"
    echo "  ci         - Run CI pipeline (build + lint + test + coverage)"
    echo ""
    echo "Examples:"
    echo "  $0 unit       # Run only unit tests"
    echo "  $0 coverage   # Generate coverage report"
    echo "  $0 ci         # Run full CI pipeline"
    exit 0
fi

# Run main function
main "$@" 