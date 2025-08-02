
import { z } from 'zod';
import { defineTool } from './tool.js';

export const generateTestFromManualSteps = defineTool({
  name: 'generate_test_from_manual_steps',
  description: 'Generates UI test automation code from manual test steps and current page analysis',
  parameters: z.object({
    manual_steps: z.array(z.string()).describe('Array of manual test steps to automate'),
    test_name: z.string().describe('Name for the generated test'),
    test_framework: z.enum(['playwright', 'cypress', 'selenium']).default('playwright').describe('Test framework to generate for'),
    output_format: z.enum(['javascript', 'typescript', 'python']).default('javascript').describe('Programming language for test output'),
  }),
  capability: 'test-generation',
}, async ({ manual_steps, test_name, test_framework, output_format }, { page, responsivePage }) => {
  
  // Get current page snapshot for context
  const snapshot = await page.accessibility.snapshot();
  const url = page.url();
  const title = await page.title();
  
  // Analyze page elements for test automation
  const pageAnalysis = await page.evaluate(() => {
    const elements = [];
    
    // Find interactive elements
    const interactiveSelectors = [
      'button', 'input', 'select', 'textarea', 'a[href]', 
      '[onclick]', '[role="button"]', '[role="link"]',
      '[data-testid]', '[id]', '[name]'
    ];
    
    interactiveSelectors.forEach(selector => {
      const elems = document.querySelectorAll(selector);
      elems.forEach((elem, index) => {
        if (elem.offsetParent !== null) { // Only visible elements
          elements.push({
            tag: elem.tagName.toLowerCase(),
            type: elem.type || null,
            id: elem.id || null,
            name: elem.name || null,
            className: elem.className || null,
            text: elem.textContent?.trim()?.substring(0, 50) || null,
            testid: elem.getAttribute('data-testid') || null,
            selector: generateSelector(elem),
            role: elem.getAttribute('role') || null,
            placeholder: elem.getAttribute('placeholder') || null
          });
        }
      });
    });
    
    function generateSelector(element) {
      // Priority order for selector generation
      if (element.getAttribute('data-testid')) {
        return `[data-testid="${element.getAttribute('data-testid')}"]`;
      }
      if (element.id) {
        return `#${element.id}`;
      }
      if (element.name) {
        return `[name="${element.name}"]`;
      }
      if (element.textContent && element.tagName.toLowerCase() === 'button') {
        return `button:has-text("${element.textContent.trim()}")`;
      }
      if (element.textContent && element.tagName.toLowerCase() === 'a') {
        return `a:has-text("${element.textContent.trim()}")`;
      }
      
      // Fallback to CSS selector
      let selector = element.tagName.toLowerCase();
      if (element.className) {
        selector += '.' + element.className.split(' ').join('.');
      }
      return selector;
    }
    
    return elements;
  });
  
  // Generate test code based on framework and language
  const testCode = generateTestCode({
    testName: test_name,
    framework: test_framework,
    language: output_format,
    url,
    title,
    manualSteps: manual_steps,
    pageElements: pageAnalysis,
    snapshot
  });
  
  return {
    testCode,
    pageAnalysis: {
      url,
      title,
      interactiveElements: pageAnalysis.length,
      elements: pageAnalysis
    },
    framework: test_framework,
    language: output_format,
    generatedAt: new Date().toISOString()
  };
});

export const analyzeTestFailure = defineTool({
  name: 'analyze_test_failure',
  description: 'Analyzes test failures and suggests fixes for UI test automation',
  parameters: z.object({
    test_code: z.string().describe('The failing test code'),
    error_message: z.string().describe('Error message from test execution'),
    test_framework: z.enum(['playwright', 'cypress', 'selenium']).default('playwright'),
    current_page_url: z.string().optional().describe('Current page URL if different from test'),
  }),
  capability: 'test-generation',
}, async ({ test_code, error_message, test_framework, current_page_url }, { page }) => {
  
  // Get current page state for comparison
  const currentState = {
    url: page.url(),
    title: await page.title(),
    timestamp: new Date().toISOString()
  };
  
  // Analyze current page elements
  const currentElements = await page.evaluate(() => {
    const elements = [];
    const selectors = ['button', 'input', 'select', 'textarea', 'a', '[data-testid]', '[id]'];
    
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(elem => {
        if (elem.offsetParent !== null) {
          elements.push({
            tag: elem.tagName.toLowerCase(),
            id: elem.id || null,
            testid: elem.getAttribute('data-testid') || null,
            text: elem.textContent?.trim()?.substring(0, 50) || null,
            selector: elem.getAttribute('data-testid') ? 
              `[data-testid="${elem.getAttribute('data-testid')}"]` : 
              (elem.id ? `#${elem.id}` : elem.tagName.toLowerCase())
          });
        }
      });
    });
    return elements;
  });
  
  // Analyze the error and suggest fixes
  const analysis = analyzeError(error_message, test_code, currentElements);
  
  return {
    errorAnalysis: analysis,
    currentPageState: currentState,
    availableElements: currentElements,
    suggestedFixes: generateFixSuggestions(analysis, test_framework),
    healedTestCode: generateHealedTest(test_code, analysis, test_framework)
  };
});

export const createTestSuite = defineTool({
  name: 'create_test_suite',
  description: 'Creates a comprehensive test suite by exploring the web application',
  parameters: z.object({
    base_url: z.string().describe('Base URL of the web application'),
    test_scenarios: z.array(z.string()).describe('List of test scenarios to cover'),
    framework: z.enum(['playwright', 'cypress']).default('playwright'),
    include_assertions: z.boolean().default(true).describe('Whether to include assertions in tests'),
  }),
  capability: 'test-generation',
}, async ({ base_url, test_scenarios, framework, include_assertions }, { page }) => {
  
  const testSuite = {
    baseUrl: base_url,
    framework,
    scenarios: [],
    generatedAt: new Date().toISOString()
  };
  
  // Navigate to base URL if not already there
  if (page.url() !== base_url) {
    await page.goto(base_url);
    await page.waitForLoadState('domcontentloaded');
  }
  
  // Analyze the application structure
  const appStructure = await page.evaluate(() => {
    const navigation = [];
    const forms = [];
    const actions = [];
    
    // Find navigation elements
    document.querySelectorAll('nav a, .nav a, [role="navigation"] a').forEach(link => {
      if (link.href && link.textContent) {
        navigation.push({
          text: link.textContent.trim(),
          href: link.href,
          selector: link.getAttribute('data-testid') ? 
            `[data-testid="${link.getAttribute('data-testid')}"]` : 
            `a:has-text("${link.textContent.trim()}")`
        });
      }
    });
    
    // Find forms
    document.querySelectorAll('form').forEach((form, index) => {
      const inputs = Array.from(form.querySelectorAll('input, select, textarea')).map(input => ({
        type: input.type || input.tagName.toLowerCase(),
        name: input.name || null,
        id: input.id || null,
        placeholder: input.placeholder || null,
        required: input.required || false
      }));
      
      forms.push({
        index,
        action: form.action || null,
        method: form.method || 'GET',
        inputs
      });
    });
    
    // Find actionable elements
    document.querySelectorAll('button, [role="button"]').forEach(button => {
      if (button.textContent && button.offsetParent !== null) {
        actions.push({
          text: button.textContent.trim(),
          type: 'button',
          selector: button.getAttribute('data-testid') ? 
            `[data-testid="${button.getAttribute('data-testid')}"]` : 
            `button:has-text("${button.textContent.trim()}")`
        });
      }
    });
    
    return { navigation, forms, actions };
  });
  
  // Generate tests for each scenario
  for (const scenario of test_scenarios) {
    const testCode = generateScenarioTest(scenario, appStructure, framework, include_assertions);
    testSuite.scenarios.push({
      name: scenario,
      code: testCode,
      elements: appStructure
    });
  }
  
  return testSuite;
});

function generateTestCode({ testName, framework, language, url, title, manualSteps, pageElements }) {
  const testTemplate = getTestTemplate(framework, language);
  
  // Convert manual steps to automated steps
  const automatedSteps = manualSteps.map(step => {
    return convertManualStepToCode(step, pageElements, framework);
  }).filter(Boolean);
  
  return testTemplate
    .replace('{{TEST_NAME}}', testName)
    .replace('{{URL}}', url)
    .replace('{{TITLE}}', title)
    .replace('{{TEST_STEPS}}', automatedSteps.join('\n    '));
}

function getTestTemplate(framework, language) {
  if (framework === 'playwright' && language === 'javascript') {
    return `import { test, expect } from '@playwright/test';

test('{{TEST_NAME}}', async ({ page }) => {
  await page.goto('{{URL}}');
  await expect(page).toHaveTitle(/{{TITLE}}/);
  
  {{TEST_STEPS}}
});`;
  }
  
  // Add more templates as needed
  return `// Generated test for {{TEST_NAME}}
// Framework: ${framework}, Language: ${language}
// Manual steps automation:
{{TEST_STEPS}}`;
}

function convertManualStepToCode(step, elements, framework) {
  const stepLower = step.toLowerCase();
  
  // Click actions
  if (stepLower.includes('click') && stepLower.includes('button')) {
    const buttonText = extractQuotedText(step) || extractButtonText(step);
    const element = elements.find(el => 
      el.tag === 'button' && el.text && el.text.toLowerCase().includes(buttonText?.toLowerCase() || '')
    );
    if (element) {
      return `await page.click('${element.selector}');`;
    }
  }
  
  // Fill input actions
  if (stepLower.includes('enter') || stepLower.includes('type') || stepLower.includes('fill')) {
    const inputText = extractQuotedText(step);
    const fieldName = extractFieldName(step);
    const element = elements.find(el => 
      (el.tag === 'input' || el.tag === 'textarea') && 
      (el.name?.toLowerCase().includes(fieldName?.toLowerCase() || '') ||
       el.placeholder?.toLowerCase().includes(fieldName?.toLowerCase() || ''))
    );
    if (element && inputText) {
      return `await page.fill('${element.selector}', '${inputText}');`;
    }
  }
  
  // Navigation actions
  if (stepLower.includes('navigate') || stepLower.includes('go to')) {
    const linkText = extractQuotedText(step) || extractLinkText(step);
    const element = elements.find(el => 
      el.tag === 'a' && el.text && el.text.toLowerCase().includes(linkText?.toLowerCase() || '')
    );
    if (element) {
      return `await page.click('${element.selector}');`;
    }
  }
  
  // Verification actions
  if (stepLower.includes('verify') || stepLower.includes('check') || stepLower.includes('see')) {
    const expectedText = extractQuotedText(step);
    if (expectedText) {
      return `await expect(page.locator('text=${expectedText}')).toBeVisible();`;
    }
  }
  
  return `// TODO: Implement step: ${step}`;
}

function extractQuotedText(text) {
  const match = text.match(/"([^"]+)"|'([^']+)'/);
  return match ? (match[1] || match[2]) : null;
}

function extractButtonText(text) {
  const patterns = [
    /click(?:\s+the)?\s+(.+?)\s+button/i,
    /press(?:\s+the)?\s+(.+?)\s+button/i,
    /click(?:\s+on)?\s+(.+)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function extractFieldName(text) {
  const patterns = [
    /(?:enter|type|fill)(?:\s+in)?(?:\s+the)?\s+(.+?)\s+(?:field|input|box)/i,
    /(?:enter|type|fill)\s+.+?\s+(?:in|into)(?:\s+the)?\s+(.+)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function extractLinkText(text) {
  const patterns = [
    /(?:click|navigate|go)(?:\s+to)?(?:\s+the)?\s+(.+?)\s+(?:link|page)/i,
    /(?:navigate|go)\s+to\s+(.+)/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function analyzeError(errorMessage, testCode, currentElements) {
  const analysis = {
    errorType: 'unknown',
    missingElement: null,
    suggestedSelector: null,
    reason: 'Unable to determine error cause'
  };
  
  if (errorMessage.includes('Element not found') || errorMessage.includes('locator')) {
    analysis.errorType = 'element_not_found';
    
    // Extract selector from error message
    const selectorMatch = errorMessage.match(/['"`]([^'"`]+)['"`]/);
    if (selectorMatch) {
      const failedSelector = selectorMatch[1];
      analysis.missingElement = failedSelector;
      
      // Find similar elements
      const similar = currentElements.filter(el => 
        el.text && failedSelector.includes(el.text.substring(0, 10))
      );
      
      if (similar.length > 0) {
        analysis.suggestedSelector = similar[0].selector;
        analysis.reason = `Element selector changed. Found similar element: ${similar[0].selector}`;
      } else {
        analysis.reason = 'Element no longer exists or selector has changed';
      }
    }
  } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
    analysis.errorType = 'timeout';
    analysis.reason = 'Element took too long to appear or action to complete';
  } else if (errorMessage.includes('navigation') || errorMessage.includes('goto')) {
    analysis.errorType = 'navigation';
    analysis.reason = 'Page navigation failed or URL has changed';
  }
  
  return analysis;
}

function generateFixSuggestions(analysis, framework) {
  const suggestions = [];
  
  if (analysis.errorType === 'element_not_found') {
    if (analysis.suggestedSelector) {
      suggestions.push(`Update selector from '${analysis.missingElement}' to '${analysis.suggestedSelector}'`);
    }
    suggestions.push('Check if element ID or data-testid attributes have changed');
    suggestions.push('Verify element is visible and not hidden by CSS');
    suggestions.push('Add wait conditions before interacting with the element');
  } else if (analysis.errorType === 'timeout') {
    suggestions.push('Increase timeout duration');
    suggestions.push('Add explicit wait for element to be visible');
    suggestions.push('Check if page loading takes longer than expected');
  } else if (analysis.errorType === 'navigation') {
    suggestions.push('Verify URL is correct and accessible');
    suggestions.push('Check for redirects or URL changes');
    suggestions.push('Add wait for navigation to complete');
  }
  
  return suggestions;
}

function generateHealedTest(originalCode, analysis, framework) {
  let healedCode = originalCode;
  
  if (analysis.errorType === 'element_not_found' && analysis.suggestedSelector) {
    // Replace the failed selector with suggested one
    healedCode = healedCode.replace(
      new RegExp(analysis.missingElement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      analysis.suggestedSelector
    );
  }
  
  if (analysis.errorType === 'timeout') {
    // Add explicit waits
    healedCode = healedCode.replace(
      /(await page\.click\([^)]+\))/g,
      'await page.waitForSelector($1.match(/[\'"](.*?)[\'"]/)[1], { state: "visible" });\n    $1'
    );
  }
  
  return healedCode;
}

function generateScenarioTest(scenario, appStructure, framework, includeAssertions) {
  const scenarioLower = scenario.toLowerCase();
  let testSteps = [];
  
  // Generate steps based on scenario description
  if (scenarioLower.includes('login')) {
    const loginForm = appStructure.forms.find(form => 
      form.inputs.some(input => input.type === 'password')
    );
    if (loginForm) {
      testSteps.push('// Login scenario');
      loginForm.inputs.forEach(input => {
        if (input.type === 'email' || input.name?.includes('email')) {
          testSteps.push(`await page.fill('[name="${input.name}"]', 'test@example.com');`);
        } else if (input.type === 'password') {
          testSteps.push(`await page.fill('[name="${input.name}"]', 'password123');`);
        }
      });
      testSteps.push('await page.click(\'button[type="submit"]\');');
      
      if (includeAssertions) {
        testSteps.push('await expect(page).toHaveURL(/dashboard|profile|home/);');
      }
    }
  } else if (scenarioLower.includes('navigation')) {
    testSteps.push('// Navigation scenario');
    appStructure.navigation.slice(0, 3).forEach(nav => {
      testSteps.push(`await page.click('${nav.selector}');`);
      if (includeAssertions) {
        testSteps.push(`await expect(page).toHaveURL('${nav.href}');`);
      }
    });
  } else if (scenarioLower.includes('form')) {
    const form = appStructure.forms[0];
    if (form) {
      testSteps.push('// Form submission scenario');
      form.inputs.forEach(input => {
        if (input.type === 'text' || input.type === 'email') {
          testSteps.push(`await page.fill('[name="${input.name}"]', 'test value');`);
        }
      });
      testSteps.push('await page.click(\'button[type="submit"]\');');
      
      if (includeAssertions) {
        testSteps.push('await expect(page.locator(\'.success-message\')).toBeVisible();');
      }
    }
  }
  
  return testSteps.join('\n    ');
}

export default [
  generateTestFromManualSteps,
  analyzeTestFailure, 
  createTestSuite
];