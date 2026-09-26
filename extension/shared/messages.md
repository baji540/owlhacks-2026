# Canary Internal Message Passing Contract

This document defines the schema for all internal messages passed between `content.js`, `background.js`, and `popup.js`.

---

## 1. Action: Analyze Email

### Sent By
- `content.js` (when an email row or opened message is detected)
- `popup.js` (when manually triggering a re-scan)

### Handled By
- `background.js` (service worker threat engine)

### Request Payload
```javascript
{
  type: "ANALYZE_EMAIL",
  payload: {
    sender: "Chase Security Alert <no-reply@chase-support-verify.xyz>",
    subject: "URGENT: Unauthorized wire transfer detected - account suspended",
    bodySnippet: "We detected an unauthorized wire transfer. Account suspended immediately."
  }
}