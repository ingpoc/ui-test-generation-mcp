# Playwright UI Test Automation MCP Server

A specialized Model Context Protocol (MCP) server that provides comprehensive UI test automation capabilities for web applications. This server enables intelligent test creation, test healing, and manual test conversion through browser automation.

## 🎯 Primary Use Cases

### 1. **Create New UI Test Automation**
- Analyze web applications and generate automated test scripts
- Support for multiple frameworks (Playwright, Cypress, Selenium)
- Generate tests in JavaScript, TypeScript, or Python
- Intelligent element detection and selector generation

### 2. **Heal Broken UI Test Automation**
- Analyze failing test cases and identify root causes
- Compare current page state with test expectations
- Automatically suggest fixes for broken selectors or timing issues
- Generate healed test code with updated selectors and improved reliability

### 3. **Convert Manual Test Cases to Automation**
- Transform manual test steps into automated test scripts
- Parse natural language test instructions
- Map manual actions to browser automation commands
- Generate comprehensive test suites from manual test documentation

## 🚀 Key Features

- **🔧 Intelligent Test Generation**: Automatically creates test automation from web app analysis
- **🛠️ Test Healing & Recovery**: Fixes broken tests by analyzing current page state
- **📋 Manual Test Conversion**: Converts manual test cases to automated scripts
- **🌐 Multi-Framework Support**: Playwright, Cypress, and Selenium compatibility
- **💻 Multi-Language Output**: JavaScript, TypeScript, and Python test generation
- **🎯 Smart Element Detection**: Advanced selector generation with fallback strategies
- **🔍 Page Analysis Engine**: Deep analysis of forms, navigation, and user workflows
- **🛡️ Enterprise Ready**: No external API dependencies, VDI-compatible deployment

## 📋 Requirements

- Node.js 18 or higher
- Compatible MCP client (Amazon Q, VS Code, or other MCP-enabled tools)
- Modern web browser (Chrome, Firefox, Safari)

## 🛠️ Installation

### Quick Setup
```bash
git clone <repository-url>
cd playwright-test-generator
npm install
```

### MCP Client Configuration

Add to your MCP client configuration file:

```json
{
  "mcpServers": {
    "playwright-test-automation": {
      "command": "node",
      "args": ["/path/to/playwright-test-generator/cli.js"],
      "env": {
        "NODE_ENV": "production"
      },
      "timeout": 60000
    }
  }
}
```

## 🎯 Core Tools

### Test Generation Tools
- **`generate_test_from_manual_steps`** - Convert manual test steps to automated code
- **`analyze_test_failure`** - Analyze and fix broken test automation
- **`create_test_suite`** - Generate comprehensive test suites from web app exploration

### Browser Automation Tools
- **`browser_navigate`** - Navigate to URLs and pages
- **`browser_snapshot`** - Capture page structure and accessibility tree
- **`browser_click`** - Click elements with intelligent targeting
- **`browser_type`** - Type text into form fields and inputs
- **`browser_evaluate`** - Execute JavaScript for advanced interactions
- **`browser_take_screenshot`** - Capture visual evidence for test validation

### Analysis & Debugging Tools
- **`browser_console_messages`** - Monitor console logs and errors
- **`browser_network_requests`** - Track network activity and API calls
- **`browser_wait_for`** - Handle dynamic content and timing

## 💡 Usage Examples

### Generate Test from Manual Steps

```javascript
// Manual test steps to automate:
const manualSteps = [
  "Fill in customer name field with 'John Doe'",
  "Enter email address 'john@example.com'",
  "Select 'Medium' from pizza size options",
  "Check 'Extra Cheese' topping",
  "Click 'Submit Order' button",
  "Verify order confirmation appears"
];

// Generate automated test
await generate_test_from_manual_steps({
  manual_steps: manualSteps,
  test_name: "Pizza Order Form Test",
  test_framework: "playwright",
  output_format: "javascript"
});
```

### Heal Broken Test

```javascript
// Analyze and fix failing test
await analyze_test_failure({
  test_code: `
    await page.click('#submit-btn');
    await expect(page.locator('.success')).toBeVisible();
  `,
  error_message: "Element not found: #submit-btn",
  test_framework: "playwright"
});
```

### Create Comprehensive Test Suite

```javascript
// Generate full test suite for web application
await create_test_suite({
  base_url: "https://your-webapp.com",
  test_scenarios: [
    "User login flow",
    "Product search and filtering",
    "Shopping cart operations",
    "Checkout process"
  ],
  framework: "playwright",
  include_assertions: true
});
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   MCP Client    │◄──►│  MCP Server      │◄──►│  Web Browser    │
│  (Amazon Q)     │    │ Test Generator   │    │ (Live Web App)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  Generated Tests │
                       │ • Playwright     │
                       │ • Cypress        │
                       │ • Selenium       │
                       └──────────────────┘
```

The MCP server acts as an intelligent bridge between your MCP client and web applications, providing:

1. **Real-time browser automation** for test creation
2. **Intelligent analysis** of page structure and user workflows
3. **Automated test generation** in multiple frameworks and languages
4. **Test healing capabilities** for maintaining test reliability
5. **Enterprise-grade security** with local-only operation

## 🛡️ Enterprise & Security Features

- **Local Operation Only**: All processing happens locally, no external API calls
- **No Cloud Dependencies**: Completely self-contained for secure environments
- **VDI Compatible**: Optimized for Virtual Desktop Infrastructure deployment
- **Data Privacy**: Web application data never leaves your environment
- **Audit Trail**: Complete logging of all automation activities
- **Access Control**: Configurable capabilities and tool filtering

## 🔧 Configuration Options

### Environment Variables
```bash
NODE_ENV=production          # Production mode
BROWSER_TYPE=chromium        # Browser selection (chromium, firefox, webkit)
HEADLESS=true               # Headless browser operation
OUTPUT_DIR=/path/to/output   # Directory for screenshots and logs
```

### Capability Management
The server supports granular capability control:
- `core` - Essential browser automation tools
- `test-generation` - Test creation and healing tools
- `vision` - Visual testing and analysis (optional)
- `pdf` - PDF generation capabilities (optional)

## 📊 Test Generation Capabilities

### Supported Test Frameworks
- **Playwright** - Modern, reliable, cross-browser testing
- **Cypress** - Developer-friendly testing framework
- **Selenium** - Industry-standard web automation

### Output Languages
- **JavaScript** - Most common test automation language
- **TypeScript** - Type-safe test development
- **Python** - Popular choice for test automation teams

### Test Types Generated
- **Smoke Tests** - Basic functionality verification
- **Integration Tests** - Multi-component workflow testing
- **Regression Tests** - Change impact validation
- **User Journey Tests** - End-to-end user experience testing

## 🎯 Workflow Examples

### New Test Creation Workflow
1. **Navigate** to target web application
2. **Analyze** page structure and user flows
3. **Generate** test automation code
4. **Validate** generated tests
5. **Export** to your test framework

### Test Healing Workflow
1. **Identify** failing test cases
2. **Analyze** current page state vs. test expectations
3. **Compare** element selectors and page structure
4. **Generate** healed test code with fixes
5. **Validate** repaired test functionality

### Manual Test Conversion Workflow
1. **Import** manual test case documentation
2. **Parse** test steps and expected outcomes
3. **Map** manual actions to automation commands
4. **Generate** executable test scripts
5. **Review** and customize generated automation

## 🚀 Getting Started

### Quick Start Guide

1. **Install the MCP server** following the installation instructions
2. **Configure your MCP client** (Amazon Q recommended for enterprise use)
3. **Navigate to your web application** using `browser_navigate`
4. **Analyze the application** with `browser_snapshot` for page structure
5. **Generate your first test** using `generate_test_from_manual_steps`
6. **Verify test quality** by running the generated automation code

### Best Practices

- **Use descriptive test names** that clearly indicate the test purpose
- **Include assertions** to validate expected outcomes
- **Prefer data-testid attributes** for reliable element selection
- **Test incrementally** - start with simple flows, then add complexity
- **Review generated code** before adding to your test suite
- **Maintain test data** separately for better test maintainability

## 📈 Enterprise Benefits

- **Accelerated Test Creation**: Reduce manual test automation development time by 70%
- **Improved Test Reliability**: Intelligent healing reduces test maintenance overhead
- **Consistent Quality**: Standardized test generation patterns across teams
- **Knowledge Transfer**: Convert manual testing expertise into automated assets
- **Scalable Testing**: Generate comprehensive test coverage efficiently
- **Cost Effective**: Reduce QA automation development and maintenance costs

## 🔍 Troubleshooting

### Common Issues

**Test Generation Fails**
- Ensure web application is fully loaded before analysis
- Check that interactive elements are visible and accessible
- Verify element selectors are stable and unique

**Element Not Found Errors**
- Use test healing functionality to update selectors
- Consider using data-testid attributes for better stability
- Check for dynamic content that may require wait conditions

**Performance Issues**
- Increase timeout values for slow-loading applications
- Use headless mode for faster execution
- Consider element visibility checks before interactions

---

**The Playwright UI Test Automation MCP Server** - Transforming manual testing into intelligent automation for modern web applications!# ui-test-generation-mcp
