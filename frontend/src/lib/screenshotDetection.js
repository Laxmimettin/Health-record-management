// Screenshot Detection and Prevention System
import api from './api';

class ScreenshotDetection {
  constructor() {
    this.isMonitoring = false;
    this.detectionMethods = [];
    this.lastActivity = Date.now();
    this.suspiciousActivity = [];
  }

  // Initialize screenshot detection
  startMonitoring(context = {}) {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.context = context;
    
    // Multiple detection methods
    this.enableKeyboardDetection();
    this.enableVisibilityDetection();
    this.enableDevToolsDetection();
    this.enableClipboardDetection();
    this.enablePrintDetection();
    this.enableRightClickProtection();
    this.enableDragDropProtection();
    
    console.log('🛡️ Screenshot detection enabled');
  }

  // Stop monitoring
  stopMonitoring() {
    this.isMonitoring = false;
    this.detectionMethods.forEach(cleanup => cleanup());
    this.detectionMethods = [];
    console.log('🛡️ Screenshot detection disabled');
  }

  // Keyboard shortcut detection
  enableKeyboardDetection() {
    const handleKeyDown = (event) => {
      const { ctrlKey, metaKey, shiftKey, altKey, key, code } = event;
      
      // Common screenshot shortcuts
      const screenshotCombos = [
        // Windows/Linux
        { ctrl: true, shift: true, key: 'S' }, // Ctrl+Shift+S (Snipping Tool)
        { ctrl: true, key: 'PrintScreen' },    // Ctrl+PrtScn
        { alt: true, key: 'PrintScreen' },     // Alt+PrtScn
        { key: 'PrintScreen' },                // PrtScn
        
        // Mac
        { meta: true, shift: true, key: '3' }, // Cmd+Shift+3 (Full screen)
        { meta: true, shift: true, key: '4' }, // Cmd+Shift+4 (Selection)
        { meta: true, shift: true, key: '5' }, // Cmd+Shift+5 (Screenshot utility)
        
        // Browser dev tools
        { key: 'F12' },                        // F12 (Dev Tools)
        { ctrl: true, shift: true, key: 'I' }, // Ctrl+Shift+I (Dev Tools)
        { ctrl: true, shift: true, key: 'J' }, // Ctrl+Shift+J (Console)
        { ctrl: true, shift: true, key: 'C' }, // Ctrl+Shift+C (Element inspector)
        
        // Other suspicious combinations
        { ctrl: true, key: 'S' },              // Ctrl+S (Save page)
        { ctrl: true, key: 'P' },              // Ctrl+P (Print)
        { ctrl: true, shift: true, key: 'P' }, // Ctrl+Shift+P (Print preview)
      ];

      const isScreenshotCombo = screenshotCombos.some(combo => {
        return (
          (!combo.ctrl || ctrlKey) &&
          (!combo.meta || metaKey) &&
          (!combo.shift || shiftKey) &&
          (!combo.alt || altKey) &&
          (combo.key === key || combo.code === code)
        );
      });

      if (isScreenshotCombo) {
        event.preventDefault();
        event.stopPropagation();
        this.logThreat('SCREENSHOT_ATTEMPT', {
          method: 'keyboard_shortcut',
          keys: `${ctrlKey ? 'Ctrl+' : ''}${metaKey ? 'Cmd+' : ''}${shiftKey ? 'Shift+' : ''}${altKey ? 'Alt+' : ''}${key}`,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        });
        
        this.showWarning('Screenshot attempt detected and blocked!');
        return false;
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    this.detectionMethods.push(() => {
      document.removeEventListener('keydown', handleKeyDown, true);
    });
  }

  // Page visibility detection (tab switching during screenshot)
  enableVisibilityDetection() {
    let visibilityChangeCount = 0;
    let lastVisibilityChange = Date.now();

    const handleVisibilityChange = () => {
      const now = Date.now();
      const timeSinceLastChange = now - lastVisibilityChange;
      
      if (document.hidden) {
        visibilityChangeCount++;
        
        // Rapid tab switching might indicate screenshot tools
        if (timeSinceLastChange < 1000 && visibilityChangeCount > 3) {
          this.logThreat('SUSPICIOUS_TAB_SWITCHING', {
            method: 'rapid_visibility_changes',
            changeCount: visibilityChangeCount,
            timeWindow: timeSinceLastChange,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      lastVisibilityChange = now;
      
      // Reset counter after 5 seconds of normal behavior
      setTimeout(() => {
        if (Date.now() - lastVisibilityChange > 5000) {
          visibilityChangeCount = 0;
        }
      }, 5000);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    this.detectionMethods.push(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    });
  }

  // Developer tools detection
  enableDevToolsDetection() {
    let devtools = { open: false, orientation: null };
    
    const threshold = 160;
    
    setInterval(() => {
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        if (!devtools.open) {
          devtools.open = true;
          this.logThreat('DEVTOOLS_OPENED', {
            method: 'developer_tools',
            windowDimensions: {
              outer: { width: window.outerWidth, height: window.outerHeight },
              inner: { width: window.innerWidth, height: window.innerHeight }
            },
            timestamp: new Date().toISOString()
          });
          this.showWarning('Developer tools detected! This activity is being logged.');
        }
      } else {
        devtools.open = false;
      }
    }, 500);
  }

  // Clipboard monitoring
  enableClipboardDetection() {
    const handleCopy = (event) => {
      // Check if copying sensitive content
      const selection = window.getSelection().toString();
      if (selection.length > 50) { // Copying substantial content
        this.logThreat('CONTENT_COPY_ATTEMPT', {
          method: 'clipboard_copy',
          contentLength: selection.length,
          contentPreview: selection.substring(0, 100) + '...',
          timestamp: new Date().toISOString()
        });
        
        // Optionally prevent copying
        event.preventDefault();
        this.showWarning('Copying medical records is not allowed!');
      }
    };

    document.addEventListener('copy', handleCopy);
    this.detectionMethods.push(() => {
      document.removeEventListener('copy', handleCopy);
    });
  }

  // Print detection
  enablePrintDetection() {
    const handleBeforePrint = () => {
      this.logThreat('PRINT_ATTEMPT', {
        method: 'browser_print',
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
      
      // Prevent printing
      setTimeout(() => {
        window.stop();
      }, 1);
      
      this.showWarning('Printing medical records is not allowed!');
    };

    window.addEventListener('beforeprint', handleBeforePrint);
    this.detectionMethods.push(() => {
      window.removeEventListener('beforeprint', handleBeforePrint);
    });
  }

  // Right-click protection
  enableRightClickProtection() {
    const handleContextMenu = (event) => {
      event.preventDefault();
      this.logThreat('RIGHT_CLICK_ATTEMPT', {
        method: 'context_menu',
        elementTag: event.target.tagName,
        timestamp: new Date().toISOString()
      });
      this.showWarning('Right-click is disabled for security reasons.');
      return false;
    };

    document.addEventListener('contextmenu', handleContextMenu);
    this.detectionMethods.push(() => {
      document.removeEventListener('contextmenu', handleContextMenu);
    });
  }

  // Drag and drop protection
  enableDragDropProtection() {
    const handleDragStart = (event) => {
      event.preventDefault();
      this.logThreat('DRAG_DROP_ATTEMPT', {
        method: 'drag_and_drop',
        elementTag: event.target.tagName,
        timestamp: new Date().toISOString()
      });
      return false;
    };

    document.addEventListener('dragstart', handleDragStart);
    this.detectionMethods.push(() => {
      document.removeEventListener('dragstart', handleDragStart);
    });
  }

  // Log threat to backend
  async logThreat(threatType, details) {
    try {
      const threatData = {
        type: threatType,
        severity: this.getThreatSeverity(threatType),
        details: {
          ...details,
          context: this.context,
          sessionId: this.getSessionId(),
          fingerprint: await this.getDeviceFingerprint()
        },
        timestamp: new Date().toISOString()
      };

      // Send to backend audit system
      await api.post('/audit/threat', threatData);
      
      // Store locally for immediate UI updates
      this.suspiciousActivity.push(threatData);
      
      // Emit event for real-time UI updates
      window.dispatchEvent(new CustomEvent('threatDetected', { 
        detail: threatData 
      }));
      
      console.warn('🚨 Security threat detected:', threatType, details);
      
    } catch (error) {
      console.error('Failed to log security threat:', error);
    }
  }

  // Get threat severity level
  getThreatSeverity(threatType) {
    const severityMap = {
      'SCREENSHOT_ATTEMPT': 'HIGH',
      'DEVTOOLS_OPENED': 'MEDIUM',
      'PRINT_ATTEMPT': 'HIGH',
      'CONTENT_COPY_ATTEMPT': 'MEDIUM',
      'RIGHT_CLICK_ATTEMPT': 'LOW',
      'DRAG_DROP_ATTEMPT': 'LOW',
      'SUSPICIOUS_TAB_SWITCHING': 'MEDIUM'
    };
    return severityMap[threatType] || 'LOW';
  }

  // Show warning to user
  showWarning(message) {
    // Create warning overlay
    const warning = document.createElement('div');
    warning.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-black/80';
    warning.innerHTML = `
      <div class="bg-red-500 text-white p-6 rounded-xl shadow-2xl max-w-md mx-4 text-center">
        <div class="text-4xl mb-4">⚠️</div>
        <h3 class="text-xl font-bold mb-2">Security Alert</h3>
        <p class="mb-4">${message}</p>
        <p class="text-sm opacity-90">This activity has been logged and reported.</p>
        <button onclick="this.parentElement.parentElement.remove()" 
                class="mt-4 bg-white text-red-500 px-4 py-2 rounded font-semibold hover:bg-gray-100">
          I Understand
        </button>
      </div>
    `;
    
    document.body.appendChild(warning);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (warning.parentElement) {
        warning.remove();
      }
    }, 10000);
  }

  // Get session ID
  getSessionId() {
    return sessionStorage.getItem('sessionId') || 'unknown';
  }

  // Generate device fingerprint
  async getDeviceFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Device fingerprint', 2, 2);
    
    const fingerprint = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screen: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      canvas: canvas.toDataURL(),
      webgl: this.getWebGLFingerprint()
    };
    
    return btoa(JSON.stringify(fingerprint)).substring(0, 32);
  }

  // WebGL fingerprinting
  getWebGLFingerprint() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return 'no-webgl';
      
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      return debugInfo ? {
        vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
        renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      } : 'no-debug-info';
    } catch (e) {
      return 'webgl-error';
    }
  }

  // Get recent suspicious activity
  getRecentActivity() {
    return this.suspiciousActivity.slice(-10); // Last 10 activities
  }

  // Clear activity log
  clearActivity() {
    this.suspiciousActivity = [];
  }
}

// Export singleton instance
export default new ScreenshotDetection();