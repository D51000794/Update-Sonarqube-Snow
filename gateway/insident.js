
const axios = require('axios');
const nodemailer = require('nodemailer');
const { getAccessToken } = require('./oauth');
const config = require('./config.json');

async function createIncident(payload) {
  const projectKey = payload.project.key;
  const projectConfig = config.projects[projectKey] || {};

  const incidentData = {
    short_description: `Quality Gate Failed for ${payload.project.name}`,
    description: `Status: ${payload.qualityGate.status}\nURL: ${payload.project.url}`,
    urgency: projectConfig.urgency || '2',
    impact: projectConfig.impact || '2',
    severity: projectConfig.severity || '3',
    assignment_group: projectConfig.assignment_group || 'Default Group',
    caller_id: projectConfig.caller_id || 'system',
    assigned_to: projectConfig.assignee || 'Unassigned' // ✅ Include assignee
  };

  const token = await getAccessToken();
  const response = await axios.post(
    `${process.env.SERVICENOW_INSTANCE.replace(/\/+$/, '')}/api/now/table/incident`,
    incidentData,
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }
  );

  const result = response.data.result || response.data;
  const sysId = result.sys_id;
  const incidentUrl = buildIncidentUrl(sysId);

  await sendEmailNotification(incidentData, sysId, incidentUrl, payload.project.name);

  return response.data;
}

function buildIncidentUrl(sysId) {
  const base = process.env.SERVICENOW_INSTANCE.replace(/\/+$/, '');
  const uiPath = process.env.SERVICENOW_INCIDENT_UI_PATH || 'nav_to.do?uri=incident.do?sys_id=';
  return `${base}/${uiPath}${encodeURIComponent(sysId)}`;
}

async function sendEmailNotification(incidentData, sysId, incidentUrl, projectName) {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const tz = process.env.TZ || 'UTC';
  const now = new Date();
  const isoTimestamp = now.toISOString();
  const localizedTimestamp = now.toLocaleString('en-US', { timeZone: tz });
  const customMessage = process.env.EMAIL_CUSTOM_MESSAGE || 'This is an automated notification.';

  // ✅ Subject includes project name and incident ID
  const subject = `Incident Created [${sysId}] for Project: ${projectName}`;

  const textBody =
`Incident Sys ID: ${sysId}
Project: ${projectName}
Severity: ${incidentData.severity}
Assignee: ${incidentData.assigned_to}
Incident Link: ${incidentUrl}

Timestamp (ISO): ${isoTimestamp}
Timestamp (${tz}): ${localizedTimestamp}

Custom Message:
${customMessage}

Details:
${JSON.stringify(incidentData, null, 2)}
`;

  const htmlBody = `
    <p><strong>Incident Created</strong></p>
    <p><strong>Sys ID:</strong> ${sysId}</p>
    <p><strong>Project:</strong> ${escapeHtml(projectName)}</p>
    <p><strong>Severity:</strong> ${escapeHtml(incidentData.severity)}</p>
    <p><strong>Assignee:</strong> ${escapeHtml(incidentData.assigned_to)}</p>
    <p><strong>Link:</strong> <a href="${incidentUrl}">${incidentUrl}</a></p>
    <p><strong>Timestamp (ISO):</strong> ${isoTimestamp}</p>
    <p><strong>Timestamp (${escapeHtml(tz)}):</strong> ${escapeHtml(localizedTimestamp)}</p>
    <p><strong>Custom Message:</strong><br>${escapeHtml(customMessage)}</p>
    <pre style="background:#f6f8fa;padding:12px;border-radius:6px;border:1px solid #ddd;">
${escapeHtml(JSON.stringify(incidentData, null, 2))}
    </pre>
  `;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.NOTIFY_EMAIL,
    subject,
    text: textBody,
    html: htmlBody
  };

  await transporter.sendMail(mailOptions);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { createIncident };


