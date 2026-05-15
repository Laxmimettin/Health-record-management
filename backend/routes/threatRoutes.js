const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Audit = require('../models/Audit');
const Notification = require('../models/Notification');
const User = require('../models/User');

function formatThreatTimestamp(date = new Date()) {
  return date.toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).replace(' AM', ' am').replace(' PM', ' pm');
}

// Log screenshot attempt threat
router.post('/threat', auth, async (req, res) => {
  try {
    const { type, severity, details } = req.body;
    const normalizedSeverity = String(severity || 'info').toLowerCase();
    
    // For screenshot attempts, log the threat under the PATIENT's audit log
    let auditUserId = req.user.id; // Default to current user
    
    if (type === 'SCREENSHOT_ATTEMPT' && details.context?.patientId) {
      auditUserId = details.context.patientId; // Log under patient's account
    }
    
    // Create audit log entry for the threat
    const auditEntry = new Audit({
      user: auditUserId, // Patient ID for screenshot attempts
      action: type === 'SCREENSHOT_ATTEMPT' 
        ? `⚠️ Screenshot attempt detected - Dr. ${details.context?.viewerName || req.user.name} ${details.method === 'printscreen' ? 'pressed PrintScreen' : details.method === 'keyboard_shortcut' || details.method === 'keyboard' ? 'pressed a keyboard shortcut' : details.method === 'screenshare' ? 'attempted screen sharing' : 'attempted to capture'} while viewing "${details.context?.recordId || 'Unknown Record'}"`
        : `Security Threat: ${type.replace(/_/g, ' ')}`,
      category: 'threat',
      severity: normalizedSeverity,
      details: {
        threatType: type,
        method: details.method,
        doctorId: req.user.id,
        doctorName: req.user.name,
        doctorEmail: req.user.email,
        context: details.context,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        timestamp: details.timestamp,
        sessionId: details.sessionId,
        fingerprint: details.fingerprint,
        blocked: true,
        ...details
      },
      time: new Date()
    });

    await auditEntry.save();

    // If it's a screenshot attempt, also create notification for patient
    if (type === 'SCREENSHOT_ATTEMPT' && details.context?.patientId) {
      try {
        // Get method description for user-friendly display
        const methodDescriptions = {
          'keyboard_shortcut': 'pressed a keyboard shortcut',
          'printscreen': 'pressed PrintScreen',
          'screenshare': 'attempted screen sharing',
          'keyboard': 'pressed a screenshot key combination',
          'print': 'attempted to print',
          'devtools': 'opened developer tools'
        };
        
        const methodDescription = methodDescriptions[details.method] || 'attempted to capture';
        const timestamp = formatThreatTimestamp(new Date());

        // Create notification for patient with exact format requested
        const notification = new Notification({
          user: details.context.patientId,
          type: 'warning',
          title: '⚠️ Screenshot attempt detected',
          message: `Dr. ${details.context.viewerName || req.user.name} ${methodDescription} while viewing your record "${details.context.recordId || 'Unknown Record'}". The content was hidden automatically.\n\n${timestamp}`,
          metadata: {
            doctorId: req.user.id,
            doctorName: req.user.name,
            recordId: details.context.recordId,
            threatType: type,
            method: details.method,
            timestamp: details.timestamp,
            formattedTime: timestamp
          }
        });

        await notification.save();
      } catch (notificationError) {
        console.error('Failed to create patient notification:', notificationError);
      }
    }

    // Log high-severity threats to console for immediate attention
    if (normalizedSeverity === 'high' || normalizedSeverity === 'critical') {
      console.warn(`🚨 HIGH SEVERITY THREAT DETECTED:`, {
        threatType: type,
        doctor: req.user.name,
        doctorEmail: req.user.email,
        patient: details.context?.patientId,
        record: details.context?.recordId,
        method: details.method,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
    }

    res.status(201).json({
      success: true,
      message: 'Threat logged successfully',
      auditId: auditEntry._id,
      severity: normalizedSeverity,
      loggedUnder: auditUserId
    });

  } catch (error) {
    console.error('Error logging security threat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log security threat',
      error: error.message
    });
  }
});

// Log record access (open/close)
router.post('/record-access', auth, async (req, res) => {
  try {
    const { action, recordId, patientId, viewerName, duration } = req.body;
    
    const auditEntry = new Audit({
      user: req.user.id,
      action: `Record ${action.toLowerCase()}: ${recordId}`,
      category: 'access',
      severity: 'info',
      details: {
        recordId,
        patientId,
        viewerName,
        action,
        duration: duration || 0,
        userAgent: req.headers['user-agent'],
        ip: req.ip
      },
      time: new Date()
    });

    await auditEntry.save();

    res.status(201).json({
      success: true,
      message: 'Record access logged',
      auditId: auditEntry._id
    });

  } catch (error) {
    console.error('Error logging record access:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log record access',
      error: error.message
    });
  }
});

// Get threat statistics for dashboard
router.get('/threats/stats', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Get threat counts by type for the user
    const threatStats = await Audit.aggregate([
      {
        $match: {
          user: userId,
          category: 'threat',
          time: { $gte: last24Hours }
        }
      },
      {
        $group: {
          _id: '$details.threatType',
          count: { $sum: 1 },
          lastOccurrence: { $max: '$time' },
          severity: { $first: '$severity' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    // Get recent high-severity threats
    const recentThreats = await Audit.find({
      user: userId,
      category: 'threat',
      severity: { $in: ['high', 'critical'] },
      time: { $gte: last24Hours }
    })
    .sort({ time: -1 })
    .limit(5)
    .select('action details.threatType details.method time severity');

    res.json({
      success: true,
      stats: threatStats,
      recentThreats: recentThreats,
      totalThreats: threatStats.reduce((sum, stat) => sum + stat.count, 0)
    });

  } catch (error) {
    console.error('Error getting threat statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get threat statistics',
      error: error.message
    });
  }
});

// Get threats for a specific patient (for patient dashboard)
router.get('/threats/patient/:patientId', auth, async (req, res) => {
  try {
    const { patientId } = req.params;
    
    // Verify user has access to this patient's data
    if (req.user.role === 'patient' && req.user.id !== patientId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get threats logged under this patient's account
    const threats = await Audit.find({
      user: patientId,
      category: { $in: ['threat', 'warning'] }
    })
    .sort({ time: -1 })
    .limit(50)
    .populate('user', 'name email role');

    res.json({
      success: true,
      threats: threats
    });

  } catch (error) {
    console.error('Error getting patient threats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get patient threats',
      error: error.message
    });
  }
});

module.exports = router;
