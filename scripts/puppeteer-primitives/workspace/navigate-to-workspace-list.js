/**
 * Navigate to Workspace List Primitive
 * 
 * Navigates back to the main workspace list view from inside a workspace.
 * This is required before selecting a different workspace.
 */

async function navigateToWorkspaceList(page, params = {}) {
  const startTime = Date.now();
  const action = 'navigate-to-workspace-list';
  
  try {
    const timeout = params.timeout || 5000;
    
    console.log(`🔙 Navigating back to workspace list...`);
    
    // Check if we're already in workspace list view
    const currentState = await page.evaluate(() => {
      const title = document.querySelector('h1, h2, h3')?.textContent || '';
      const workspacesText = document.body.textContent;
      
      // Look for "Workspaces" title and workspace cards
      const inListView = title.includes('Workspaces') || 
                        workspacesText.includes('Welcome to Workspace Workshop');
      
      // Look for back navigation element
      const backElement = Array.from(document.querySelectorAll('*')).find(el => 
        el.textContent && el.textContent.includes('← Workspaces')
      );
      
      return {
        inListView,
        hasBackButton: !!backElement,
        currentTitle: title,
        backElementText: backElement ? backElement.textContent.trim() : null
      };
    });
    
    console.log('📊 Current navigation state:', currentState);
    
    if (currentState.inListView) {
      console.log('✅ Already in workspace list view');
      return {
        success: true,
        action,
        duration: Date.now() - startTime,
        params,
        result: { alreadyInListView: true }
      };
    }
    
    if (!currentState.hasBackButton) {
      throw new Error('No back navigation to workspace list found');
    }
    
    // Click the back navigation - be more precise about targeting
    const navigationResult = await page.evaluate(() => {
      // Look for the specific "← Workspaces" navigation element
      const backElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent?.trim() || '';
        // Look for exact or close match to "← Workspaces"
        return text === '← Workspaces' || 
               (text.includes('← Workspaces') && text.length < 50) ||
               (text.includes('Workspaces') && text.includes('←') && text.length < 50);
      });
      
      console.log(`Found ${backElements.length} potential back navigation elements`);
      
      for (const element of backElements) {
        const text = element.textContent?.trim() || '';
        console.log(`Trying element: ${text.substring(0, 30)} (${element.tagName})`);
        
        try {
          // Prefer clickable elements like buttons or links
          let clickTarget = element;
          
          if (element.tagName === 'BUTTON' || element.tagName === 'A') {
            clickTarget = element;
          } else {
            // Look for a clickable parent or child
            const clickableParent = element.closest('button, a, [role="button"], [class*="cursor-pointer"]');
            const clickableChild = element.querySelector('button, a, [role="button"]');
            
            if (clickableChild) {
              clickTarget = clickableChild;
            } else if (clickableParent) {
              clickTarget = clickableParent;
            }
          }
          
          console.log(`Clicking target: ${clickTarget.tagName} with text: ${clickTarget.textContent?.trim().substring(0, 30)}`);
          clickTarget.click();
          
          return { 
            success: true, 
            clicked: clickTarget.textContent?.trim().substring(0, 50) || 'no text',
            tagName: clickTarget.tagName,
            originalText: text.substring(0, 50)
          };
        } catch (error) {
          console.log(`Failed to click element: ${error.message}`);
          continue;
        }
      }
      
      return { success: false, error: 'Could not find or click back navigation' };
    });
    
    if (!navigationResult.success) {
      throw new Error(navigationResult.error);
    }
    
    console.log(`✅ Clicked back navigation: ${navigationResult.clicked}`);
    
    // Wait for navigation to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify we're back in list view
    const finalState = await page.evaluate(() => {
      const title = document.querySelector('h1, h2, h3')?.textContent || '';
      const workspacesText = document.body.textContent;
      
      const inListView = title.includes('Workspaces') || 
                        workspacesText.includes('Welcome to Workspace Workshop');
      
      // Count workspace cards to confirm we're in list view
      const workspaceCards = Array.from(document.querySelectorAll('div')).filter(el => {
        const text = el.textContent || '';
        const hasWorkspace = text.includes('Workspace - ');
        const isCard = el.classList.contains('cursor-pointer') && 
                      el.classList.contains('rounded-lg') &&
                      el.classList.contains('border');
        return hasWorkspace && isCard && text.length < 300;
      });
      
      return {
        inListView,
        workspaceCardsFound: workspaceCards.length,
        currentTitle: title
      };
    });
    
    console.log('📊 Final navigation state:', finalState);
    
    if (!finalState.inListView || finalState.workspaceCardsFound === 0) {
      throw new Error('Failed to reach workspace list view');
    }
    
    const duration = Date.now() - startTime;
    console.log(`✅ Navigated back to workspace list (${duration}ms)`);
    
    return {
      success: true,
      action,
      duration,
      params,
      result: {
        workspaceCardsFound: finalState.workspaceCardsFound,
        finalTitle: finalState.currentTitle
      }
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ ${action} failed:`, error.message);
    
    return {
      success: false,
      action,
      duration,
      params,
      error: error.message
    };
  }
}

module.exports = navigateToWorkspaceList;