
export class PageAnalyzer {
  constructor(page) {
    this.page = page;
  }

  async analyzeForTestGeneration() {
    const analysis = await this.page.evaluate(() => {
      const result = {
        pageInfo: {
          url: window.location.href,
          title: document.title,
          timestamp: new Date().toISOString()
        },
        forms: [],
        navigation: [],
        interactiveElements: [],
        testableElements: [],
        workflows: []
      };

      // Analyze forms
      document.querySelectorAll('form').forEach((form, formIndex) => {
        const formData = {
          index: formIndex,
          action: form.action || window.location.href,
          method: form.method || 'GET',
          id: form.id || null,
          className: form.className || null,
          inputs: [],
          buttons: []
        };

        // Analyze form inputs
        form.querySelectorAll('input, select, textarea').forEach(input => {
          formData.inputs.push({
            type: input.type || input.tagName.toLowerCase(),
            name: input.name || null,
            id: input.id || null,
            placeholder: input.placeholder || null,
            required: input.required || false,
            value: input.value || null,
            selector: this.generateSelector(input),
            label: this.findLabelFor(input)
          });
        });

        // Analyze form buttons
        form.querySelectorAll('button, input[type="submit"], input[type="button"]').forEach(button => {
          formData.buttons.push({
            type: button.type || 'button',
            text: button.textContent?.trim() || button.value || null,
            selector: this.generateSelector(button)
          });
        });

        result.forms.push(formData);
      });

      // Analyze navigation elements
      const navSelectors = ['nav a', '.nav a', '.navbar a', '[role="navigation"] a', 'header a', '.menu a'];
      navSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(link => {
          if (link.href && link.offsetParent !== null) {
            result.navigation.push({
              text: link.textContent?.trim() || '',
              href: link.href,
              selector: this.generateSelector(link),
              isExternal: !link.href.startsWith(window.location.origin)
            });
          }
        });
      });

      // Analyze interactive elements
      const interactiveSelectors = [
        'button', '[role="button"]', '[onclick]', 
        'a[href]', 'input[type="checkbox"]', 'input[type="radio"]',
        '[data-testid]', '[data-cy]', '[data-test]'
      ];
      
      interactiveSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(element => {
          if (element.offsetParent !== null) {
            result.interactiveElements.push({
              tag: element.tagName.toLowerCase(),
              type: element.type || null,
              text: element.textContent?.trim()?.substring(0, 100) || null,
              selector: this.generateSelector(element),
              role: element.getAttribute('role') || null,
              testId: element.getAttribute('data-testid') || 
                      element.getAttribute('data-cy') || 
                      element.getAttribute('data-test') || null,
              id: element.id || null,
              className: element.className || null,
              isVisible: this.isElementVisible(element),
              boundingBox: element.getBoundingClientRect()
            });
          }
        });
      });

      // Generate test selectors for all testable elements
      result.testableElements = this.generateTestableElements();

      // Identify common user workflows
      result.workflows = this.identifyWorkflows(result.forms, result.navigation, result.interactiveElements);

      return result;
    });

    return analysis;
  }

  async analyzePageChanges(previousAnalysis) {
    const currentAnalysis = await this.analyzeForTestGeneration();
    
    const changes = {
      timestamp: new Date().toISOString(),
      url_changed: previousAnalysis.pageInfo.url !== currentAnalysis.pageInfo.url,
      title_changed: previousAnalysis.pageInfo.title !== currentAnalysis.pageInfo.title,
      forms: this.compareArrays(previousAnalysis.forms, currentAnalysis.forms, 'id'),
      navigation: this.compareArrays(previousAnalysis.navigation, currentAnalysis.navigation, 'href'),
      elements: this.compareArrays(previousAnalysis.interactiveElements, currentAnalysis.interactiveElements, 'selector'),
      added_elements: [],
      removed_elements: [],
      modified_elements: []
    };

    return {
      changes,
      currentAnalysis,
      previousAnalysis
    };
  }

  compareArrays(oldArray, newArray, keyField) {
    const oldKeys = new Set(oldArray.map(item => item[keyField]));
    const newKeys = new Set(newArray.map(item => item[keyField]));
    
    return {
      added: newArray.filter(item => !oldKeys.has(item[keyField])),
      removed: oldArray.filter(item => !newKeys.has(item[keyField])),
      unchanged: newArray.filter(item => oldKeys.has(item[keyField]))
    };
  }

  async generateTestCode(analysis, options = {}) {
    const {
      framework = 'playwright',
      language = 'javascript',
      includeAssertions = true,
      testType = 'smoke'
    } = options;

    let testCode = '';

    if (framework === 'playwright' && language === 'javascript') {
      testCode = this.generatePlaywrightTest(analysis, includeAssertions, testType);
    } else if (framework === 'cypress' && language === 'javascript') {
      testCode = this.generateCypressTest(analysis, includeAssertions, testType);
    }

    return testCode;
  }

  generatePlaywrightTest(analysis, includeAssertions, testType) {
    const { pageInfo, forms, navigation, interactiveElements } = analysis;
    
    let testCode = `import { test, expect } from '@playwright/test';

test.describe('${pageInfo.title || 'Page'} Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('${pageInfo.url}');
  });
`;

    // Generate navigation tests
    if (navigation.length > 0 && testType !== 'unit') {
      testCode += `
  test('should navigate through main menu items', async ({ page }) => {`;
      navigation.slice(0, 5).forEach(nav => {
        if (!nav.isExternal) {
          testCode += `
    await page.click('${nav.selector}');`;
          if (includeAssertions) {
            testCode += `
    await expect(page).toHaveURL('${nav.href}');
    await page.goBack();`;
          }
        }
      });
      testCode += `
  });
`;
    }

    // Generate form tests
    forms.forEach((form, index) => {
      if (form.inputs.length > 0) {
        testCode += `
  test('should fill and submit form ${index + 1}', async ({ page }) => {`;
        
        form.inputs.forEach(input => {
          const testValue = this.generateTestValue(input);
          if (testValue) {
            testCode += `
    await page.fill('${input.selector}', '${testValue}');`;
          }
        });

        if (form.buttons.length > 0) {
          const submitButton = form.buttons.find(btn => 
            btn.type === 'submit' || 
            btn.text?.toLowerCase().includes('submit') ||
            btn.text?.toLowerCase().includes('save')
          ) || form.buttons[0];
          
          testCode += `
    await page.click('${submitButton.selector}');`;
          
          if (includeAssertions) {
            testCode += `
    // Add assertions for form submission result
    // await expect(page.locator('.success-message')).toBeVisible();`;
          }
        }

        testCode += `
  });
`;
      }
    });

    // Generate interaction tests
    if (interactiveElements.length > 0 && testType !== 'unit') {
      const buttons = interactiveElements.filter(el => 
        el.tag === 'button' || el.role === 'button'
      );
      
      if (buttons.length > 0) {
        testCode += `
  test('should interact with page buttons', async ({ page }) => {`;
        buttons.slice(0, 3).forEach(button => {
          testCode += `
    await page.click('${button.selector}');`;
          if (includeAssertions) {
            testCode += `
    // Add assertion for button click result`;
          }
        });
        testCode += `
  });
`;
      }
    }

    testCode += `});
`;

    return testCode;
  }

  generateCypressTest(analysis, includeAssertions, testType) {
    const { pageInfo, forms, navigation } = analysis;
    
    let testCode = `describe('${pageInfo.title || 'Page'} Tests', () => {
  beforeEach(() => {
    cy.visit('${pageInfo.url}');
  });
`;

    // Generate navigation tests
    if (navigation.length > 0) {
      testCode += `
  it('should navigate through main menu', () => {`;
      navigation.slice(0, 3).forEach(nav => {
        if (!nav.isExternal) {
          testCode += `
    cy.get('${nav.selector}').click();`;
          if (includeAssertions) {
            testCode += `
    cy.url().should('include', '${new URL(nav.href).pathname}');
    cy.go('back');`;
          }
        }
      });
      testCode += `
  });
`;
    }

    // Generate form tests
    forms.forEach((form, index) => {
      if (form.inputs.length > 0) {
        testCode += `
  it('should fill form ${index + 1}', () => {`;
        
        form.inputs.forEach(input => {
          const testValue = this.generateTestValue(input);
          if (testValue) {
            testCode += `
    cy.get('${input.selector}').type('${testValue}');`;
          }
        });

        if (form.buttons.length > 0) {
          testCode += `
    cy.get('${form.buttons[0].selector}').click();`;
        }

        testCode += `
  });
`;
      }
    });

    testCode += `});
`;

    return testCode;
  }

  generateTestValue(input) {
    switch (input.type) {
      case 'email':
        return 'test@example.com';
      case 'password':
        return 'password123';
      case 'text':
        return input.placeholder || 'Test Value';
      case 'number':
        return '123';
      case 'tel':
        return '555-1234';
      case 'url':
        return 'https://example.com';
      case 'date':
        return '2024-01-01';
      default:
        return input.placeholder || 'Test Value';
    }
  }

  // Helper methods that would be available in browser context
  static generateSelector(element) {
    // Priority order for selector generation
    if (element.getAttribute('data-testid')) {
      return `[data-testid="${element.getAttribute('data-testid')}"]`;
    }
    if (element.getAttribute('data-cy')) {
      return `[data-cy="${element.getAttribute('data-cy')}"]`;
    }
    if (element.id) {
      return `#${element.id}`;
    }
    if (element.name) {
      return `[name="${element.name}"]`;
    }
    if (element.textContent && ['button', 'a'].includes(element.tagName.toLowerCase())) {
      const text = element.textContent.trim().substring(0, 30);
      return `${element.tagName.toLowerCase()}:has-text("${text}")`;
    }
    
    // Fallback to CSS selector
    let selector = element.tagName.toLowerCase();
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.length > 0);
      if (classes.length > 0) {
        selector += '.' + classes.slice(0, 2).join('.');
      }
    }
    return selector;
  }

  static findLabelFor(input) {
    // Find associated label
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) return label.textContent?.trim();
    }
    
    // Find parent label
    const parentLabel = input.closest('label');
    if (parentLabel) return parentLabel.textContent?.trim();
    
    // Find previous sibling label
    const prevLabel = input.previousElementSibling;
    if (prevLabel && prevLabel.tagName === 'LABEL') {
      return prevLabel.textContent?.trim();
    }
    
    return null;
  }

  static isElementVisible(element) {
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && 
           style.visibility !== 'hidden' && 
           style.opacity !== '0' &&
           element.offsetParent !== null;
  }

  static generateTestableElements() {
    const testableElements = [];
    const selectors = [
      '[data-testid]', '[data-cy]', '[data-test]',
      'button', 'a[href]', 'input', 'select', 'textarea',
      '[role="button"]', '[role="link"]', '[onclick]'
    ];

    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(element => {
        if (this.isElementVisible(element)) {
          testableElements.push({
            selector: this.generateSelector(element),
            tag: element.tagName.toLowerCase(),
            type: element.type || null,
            text: element.textContent?.trim()?.substring(0, 50) || null,
            testable: true
          });
        }
      });
    });

    return testableElements;
  }

  static identifyWorkflows(forms, navigation, interactiveElements) {
    const workflows = [];

    // Login workflow
    const loginForm = forms.find(form => 
      form.inputs.some(input => input.type === 'password') &&
      form.inputs.some(input => input.type === 'email' || 
                                input.name?.includes('email') || 
                                input.name?.includes('username'))
    );
    if (loginForm) {
      workflows.push({
        name: 'Login',
        type: 'authentication',
        steps: [
          'Navigate to login page',
          'Fill username/email field',
          'Fill password field',
          'Click login button',
          'Verify successful login'
        ],
        elements: loginForm
      });
    }

    // Registration workflow
    const registrationForm = forms.find(form => 
      form.inputs.filter(input => input.type === 'password').length >= 2 ||
      form.inputs.some(input => input.name?.includes('confirm'))
    );
    if (registrationForm) {
      workflows.push({
        name: 'Registration',
        type: 'authentication',
        steps: [
          'Navigate to registration page',
          'Fill required fields',
          'Confirm password',
          'Submit registration',
          'Verify account creation'
        ],
        elements: registrationForm
      });
    }

    // Search workflow
    const searchInput = interactiveElements.find(el => 
      el.type === 'search' || 
      el.placeholder?.toLowerCase().includes('search') ||
      el.name?.toLowerCase().includes('search')
    );
    if (searchInput) {
      workflows.push({
        name: 'Search',
        type: 'navigation',
        steps: [
          'Enter search term',
          'Execute search',
          'Verify search results'
        ],
        elements: [searchInput]
      });
    }

    return workflows;
  }
}