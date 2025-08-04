#!/usr/bin/env node

const puppeteer = require('puppeteer');

async function inspectDOM() {
  console.log('🔍 DOM Inspector - No Timeout Version');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    defaultViewport: { width: 1400, height: 900 }
  });
  
  const page = await browser.newPage();
  
  await page.goto('http://localhost:3001');
  console.log('App loaded. Waiting for hydration...');
  
  // Wait for React to hydrate
  await new Promise(r => setTimeout(r, 8000));
  
  console.log('Analyzing DOM structure...');
  
  try {
    const domAnalysis = await page.evaluate(() => {
      const result = {
        workspaceSelectors: [],
        buttonSelectors: [],
        inputSelectors: [],
        allText: document.body.textContent.substring(0, 500)
      };
      
      // Find elements with "Workspace" text
      const allElements = Array.from(document.querySelectorAll('*'));
      allElements.forEach((el, index) => {
        if (el.textContent && el.textContent.includes('Workspace') && 
            el.offsetWidth > 0 && el.offsetHeight > 0 &&
            el.textContent.length < 200) {
          
          // Try to build a good selector
          let selector = el.tagName.toLowerCase();
          if (el.id) selector += `#${el.id}`;
          if (el.className) selector += `.${el.className.split(' ')[0]}`;
          
          result.workspaceSelectors.push({
            index,
            text: el.textContent.trim().substring(0, 60),
            tagName: el.tagName,
            selector: selector,
            classes: el.className,
            hasClickHandler: !!el.onclick
          });
        }
      });
      
      // Find buttons
      const buttons = Array.from(document.querySelectorAll('button'));
      buttons.forEach((btn, index) => {
        if (btn.offsetWidth > 0 && btn.offsetHeight > 0) {
          result.buttonSelectors.push({
            index,
            text: btn.textContent ? btn.textContent.trim().substring(0, 30) : '',
            classes: btn.className,
            isAgent: btn.textContent && (btn.textContent.includes('Assistant') || btn.textContent.includes('Agent'))
          });
        }
      });
      
      // Find inputs
      const inputs = Array.from(document.querySelectorAll('input'));
      inputs.forEach((input, index) => {
        if (input.offsetWidth > 0 && input.offsetHeight > 0) {
          result.inputSelectors.push({
            index,
            placeholder: input.placeholder || '',
            type: input.type,
            classes: input.className,
            bounds: {
              top: Math.round(input.getBoundingClientRect().top),
              left: Math.round(input.getBoundingClientRect().left)
            }
          });
        }
      });
      
      return result;
    });
    
    console.log('\n📋 DOM Analysis Results:');
    console.log('\n🗂️ Workspace Elements:');
    domAnalysis.workspaceSelectors.forEach((ws, i) => {
      console.log(`  ${i}: "${ws.text}" (${ws.tagName})`);
      console.log(`     Classes: ${ws.classes}`);
      console.log(`     Selector: ${ws.selector}`);
    });
    
    console.log('\n🔘 Button Elements:');
    domAnalysis.buttonSelectors.forEach((btn, i) => {
      console.log(`  ${i}: "${btn.text}" (Agent: ${btn.isAgent})`);
    });
    
    console.log('\n📝 Input Elements:');
    domAnalysis.inputSelectors.forEach((input, i) => {
      console.log(`  ${i}: placeholder:"${input.placeholder}" at (${input.bounds.left}, ${input.bounds.top})`);
    });
    
    console.log('\n📄 Page Text Preview:');
    console.log(domAnalysis.allText);
    
    // Now create a test sequence based on what we found
    if (domAnalysis.workspaceSelectors.length > 0) {
      console.log('\n🧪 Creating test sequence...');
      
      const firstWorkspace = domAnalysis.workspaceSelectors[0];
      console.log(`\nStep 1: Click workspace "${firstWorkspace.text}"`);
      
      // Click the first workspace
      await page.evaluate((selector) => {
        const elements = Array.from(document.querySelectorAll('*'));
        for (let el of elements) {
          if (el.textContent && el.textContent.includes('Workspace') && 
              el.offsetWidth > 0 && el.offsetHeight > 0 &&
              el.textContent.length < 200) {
            el.click();
            return true;
          }
        }
        return false;
      }, firstWorkspace.selector);
      
      await new Promise(r => setTimeout(r, 3000));
      
      console.log('\nStep 2: Look for agent buttons after workspace click...');
      
      const agentButtons = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons
          .filter(btn => btn.textContent && btn.textContent.includes('Assistant'))
          .map(btn => btn.textContent.trim());
      });
      
      console.log('Agent buttons found:', agentButtons);
      
      if (agentButtons.length > 0) {
        console.log('\nStep 3: Click Dev Assistant...');
        
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const devBtn = buttons.find(btn => btn.textContent && btn.textContent.includes('Dev Assistant'));
          if (devBtn) devBtn.click();
        });
        
        await new Promise(r => setTimeout(r, 3000));
        
        console.log('\nStep 4: Analyze inputs after agent click...');
        
        const finalInputs = await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input'));
          return inputs.map(input => ({
            placeholder: input.placeholder || '',
            visible: input.offsetWidth > 0 && input.offsetHeight > 0,
            bounds: input.getBoundingClientRect()
          }));
        });
        
        console.log('Final input analysis:');
        finalInputs.forEach((input, i) => {
          console.log(`  ${i}: "${input.placeholder}" visible:${input.visible}`);
        });
        
        // Try to type in the agent input
        const agentInput = finalInputs.find(input => 
          input.visible && input.placeholder.includes('command')
        );
        
        if (agentInput) {
          console.log('\nStep 5: Testing agent input...');
          
          // Use the exact placeholder to target the input
          const inputSelector = `input[placeholder*="command"]`;
          
          await page.click(inputSelector);
          await page.type(inputSelector, 'FINAL TEST MESSAGE');
          
          console.log('Typed message. Pressing Enter...');
          await page.keyboard.press('Enter');
          
          await new Promise(r => setTimeout(r, 3000));
          
          // Check result
          const testResult = await page.evaluate(() => {
            const fileSearch = document.querySelector('input[placeholder*="Search files"]');
            return {
              fileSearchValue: fileSearch ? fileSearch.value : '',
              messageInFileSearch: fileSearch ? fileSearch.value.includes('FINAL TEST') : false
            };
          });
          
          if (testResult.messageInFileSearch) {
            console.log('❌ Message went to file search:', testResult.fileSearchValue);
          } else {
            console.log('✅ Message likely sent to agent correctly');
          }
        } else {
          console.log('❌ No agent input field found');
        }
      }
    }
    
    console.log('\n✅ DOM inspection complete!');
    
  } catch (error) {
    console.error('Error during analysis:', error);
  }
  
  console.log('\nBrowser staying open for manual inspection...');
  console.log('Press Ctrl+C to close');
  
  // Keep browser open indefinitely
  await new Promise(() => {});
}

inspectDOM().catch(console.error);