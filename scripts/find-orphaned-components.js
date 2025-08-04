#!/usr/bin/env node

/**
 * Find Orphaned Components Script
 * 
 * Scans for components that are defined but not imported/used anywhere
 */

const fs = require('fs');
const path = require('path');

// Get all component files
function getAllComponentFiles(dir = 'src', files = []) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            getAllComponentFiles(fullPath, files);
        } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
            // Skip index, route, and config files
            if (!item.includes('index') && !item.includes('route') && !item.includes('config')) {
                files.push(fullPath);
            }
        }
    }
    
    return files;
}

// Extract component name from file
function getComponentName(filePath) {
    const fileName = path.basename(filePath);
    return fileName.replace(/\.(tsx?|js)$/, '');
}

// Check if component is imported anywhere
function isComponentImported(componentName, allFiles) {
    const importPatterns = [
        new RegExp(`import.*${componentName}.*from`, 'g'),
        new RegExp(`import.*{.*${componentName}.*}.*from`, 'g'),
        new RegExp(`const.*${componentName}.*=.*lazy`, 'g'),
        new RegExp(`<${componentName}`, 'g'), // Direct usage
    ];
    
    for (const file of allFiles) {
        try {
            const content = fs.readFileSync(file, 'utf8');
            
            for (const pattern of importPatterns) {
                if (pattern.test(content)) {
                    return { imported: true, usedIn: file };
                }
            }
        } catch (error) {
            // Skip files that can't be read
        }
    }
    
    return { imported: false, usedIn: null };
}

// Analyze component purpose from its content
function analyzeComponentPurpose(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Look for comments or exports to understand purpose
        const lines = content.split('\n').slice(0, 20); // First 20 lines
        const comments = lines.filter(line => line.trim().startsWith('*') || line.trim().startsWith('//'));
        
        let purpose = 'Unknown purpose';
        
        // Check for specific patterns
        if (content.includes('workspace')) purpose += ' - Workspace related';
        if (content.includes('agent')) purpose += ' - Agent related';
        if (content.includes('context')) purpose += ' - Context related';
        if (content.includes('library')) purpose += ' - Library related';
        if (content.includes('test') || content.includes('Test')) purpose = 'Test component';
        if (content.includes('lazy') || content.includes('Lazy')) purpose = 'Lazy loading component';
        if (content.includes('modal') || content.includes('Modal')) purpose += ' - Modal/Dialog';
        if (content.includes('git') || content.includes('Git')) purpose += ' - Git operations';
        
        // Extract first meaningful comment
        const meaningfulComment = comments.find(c => 
            c.length > 10 && 
            !c.includes('*') && 
            !c.includes('eslint') && 
            !c.includes('TODO')
        );
        
        if (meaningfulComment) {
            purpose = meaningfulComment.replace(/^\s*[*\/]+\s*/, '').trim();
        }
        
        return purpose;
    } catch (error) {
        return 'Could not analyze';
    }
}

// Check if component has dependencies that might also be orphaned
function findDependencies(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const importMatches = content.match(/import.*from\s+['"]([^'"]+)['"]/g) || [];
        
        return importMatches
            .map(match => {
                const pathMatch = match.match(/from\s+['"]([^'"]+)['"]/);
                return pathMatch ? pathMatch[1] : null;
            })
            .filter(Boolean)
            .filter(path => path.startsWith('.') || path.startsWith('@/')) // Local imports only
            .map(path => path.replace('@/', 'src/'));
    } catch (error) {
        return [];
    }
}

// Main analysis
function main() {
    console.log('🔍 Analyzing components for orphaned status...\n');
    
    const componentFiles = getAllComponentFiles();
    const allFiles = getAllComponentFiles(); // Include all files for searching
    
    const orphanedComponents = [];
    const activeComponents = [];
    
    for (const file of componentFiles) {
        const componentName = getComponentName(file);
        const { imported, usedIn } = isComponentImported(componentName, allFiles);
        
        if (!imported) {
            const purpose = analyzeComponentPurpose(file);
            const dependencies = findDependencies(file);
            
            orphanedComponents.push({
                filePath: file,
                componentName,
                purpose,
                dependencies,
                shouldRemove: purpose.includes('test') || purpose.includes('Test') || purpose.includes('Lazy'),
                mightBeNeededLater: purpose.includes('git') || purpose.includes('Git') || purpose.includes('agent') || purpose.includes('Agent')
            });
        } else {
            activeComponents.push({
                filePath: file,
                componentName,
                usedIn
            });
        }
    }
    
    // Report results
    console.log(`📊 Analysis Results:`);
    console.log(`   Total components: ${componentFiles.length}`);
    console.log(`   Active components: ${activeComponents.length}`);
    console.log(`   Orphaned components: ${orphanedComponents.length}\n`);
    
    if (orphanedComponents.length > 0) {
        console.log('🚨 ORPHANED COMPONENTS:\n');
        
        orphanedComponents.forEach((comp, index) => {
            console.log(`${index + 1}. ${comp.componentName}`);
            console.log(`   📁 Path: ${comp.filePath}`);
            console.log(`   🎯 Purpose: ${comp.purpose}`);
            console.log(`   🔗 Dependencies: ${comp.dependencies.length > 0 ? comp.dependencies.join(', ') : 'None'}`);
            
            if (comp.shouldRemove) {
                console.log(`   ❌ Recommendation: SAFE TO REMOVE (test/development component)`);
            } else if (comp.mightBeNeededLater) {
                console.log(`   ⚠️  Recommendation: KEEP - might be needed for future features`);
            } else {
                console.log(`   🤔 Recommendation: REVIEW - check if part of planned features`);
            }
            console.log('');
        });
        
        // Summary recommendations
        const safeToRemove = orphanedComponents.filter(c => c.shouldRemove);
        const keepForFuture = orphanedComponents.filter(c => c.mightBeNeededLater);
        const needReview = orphanedComponents.filter(c => !c.shouldRemove && !c.mightBeNeededLater);
        
        console.log('📋 SUMMARY RECOMMENDATIONS:');
        console.log(`   ❌ Safe to remove: ${safeToRemove.length} components`);
        console.log(`   ⚠️  Keep for future: ${keepForFuture.length} components`);
        console.log(`   🤔 Need review: ${needReview.length} components\n`);
        
        if (safeToRemove.length > 0) {
            console.log('Components that can be safely removed:');
            safeToRemove.forEach(c => console.log(`   • ${c.filePath}`));
            console.log('');
        }
    } else {
        console.log('✅ No orphaned components found!\n');
    }
    
    console.log('🔄 Focus areas after workspace management rebuild:');
    const workspaceRelated = orphanedComponents.filter(c => 
        c.filePath.includes('workspace') && !c.filePath.includes('workspace-workshop')
    );
    
    if (workspaceRelated.length > 0) {
        console.log('   Old workspace management components:');
        workspaceRelated.forEach(c => {
            console.log(`   • ${c.componentName} - ${c.purpose}`);
        });
    } else {
        console.log('   ✅ No old workspace components are orphaned');
    }
}

main();