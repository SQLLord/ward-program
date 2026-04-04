// services/emailService.js
// ── Azure Communication Services email sender ────────────────────────────────
const { EmailClient } = require('@azure/communication-email');

const IS_PROD = process.env.NODE_ENV === 'production';
const CONNECTION_STRING = process.env.ACS_CONNECTION_STRING;
const SENDER_ADDRESS = process.env.ACS_SENDER_ADDRESS ?? 'donotreply@example.com';

const logDevEmail = (to, subject, html) => {
    console.log('\n============================');
    console.log('📧 [DEV EMAIL — NOT SENT]');
    console.log('============================');
    console.log(`To:      ${to}`);
    console.log(`From:    ${SENDER_ADDRESS}`);
    console.log(`Subject: ${subject}`);
    console.log('--- Body ---');
    console.log(html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
    console.log('============================\n');
};

// ── Format a date string for display ─────────────────────────────────────────
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
};

// ── Format a time string (HH:MM) for display ─────────────────────────────────
const formatTime = (timeStr) => {
    if (!timeStr) return '';
    return new Date(`2000-01-01T${timeStr}`).toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true,
    });
};

/**
 * Sends an announcement request email to all configured recipients.
 * @param {Object}   opts
 * @param {string}   opts.submitterName
 * @param {string}   opts.title
 * @param {string}   [opts.description]
 * @param {boolean}  [opts.isAllDay]
 * @param {string}   [opts.eventDate]      YYYY-MM-DD
 * @param {string}   [opts.eventEndDate]   YYYY-MM-DD
 * @param {string}   [opts.eventTime]      HH:MM
 * @param {string}   [opts.eventEndTime]   HH:MM
 * @param {string}   [opts.location]
 * @param {string}   [opts.wardName]
 * @param {string[]} opts.toEmails
 */
const sendAnnouncementRequest = async ({
    submitterName,
    title,
    description,
    isAllDay,
    eventDate,
    eventEndDate,
    eventTime,
    eventEndTime,
    location,
    wardName,
    toEmails,
}) => {
    if (!toEmails?.length) throw new Error('No recipient email addresses configured.');

    const displayName = wardName?.trim() || 'Ward Programs';
    const subject = `📢 Announcement Request: ${title}`;

    // ── Build date/time display string ────────────────────────────────────────
    let dateTimeStr = '';
    const hasDate    = !!eventDate;
    const hasEndDate = !!eventEndDate && eventEndDate !== eventDate;

    if (isAllDay) {
        if (hasDate && hasEndDate) {
            dateTimeStr = `${formatDate(eventDate)} – ${formatDate(eventEndDate)} · All Day`;
        } else if (hasDate) {
            dateTimeStr = `${formatDate(eventDate)} · All Day`;
        }
    } else {
        if (hasDate) {
            dateTimeStr = formatDate(eventDate);
            if (hasEndDate) dateTimeStr += ` – ${formatDate(eventEndDate)}`;
        }
        if (eventTime) {
            const timeLabel = formatTime(eventTime);
            const endTimeLabel = eventEndTime ? ` – ${formatTime(eventEndTime)}` : '';
            dateTimeStr += dateTimeStr ? ` · ${timeLabel}${endTimeLabel}` : `${timeLabel}${endTimeLabel}`;
        }
    }

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background:#1a56db;padding:20px 24px;border-radius:8px 8px 0 0;">
                <h2 style="color:white;margin:0;font-size:20px;">📢 New Announcement Request</h2>
                <p style="color:#bfdbfe;margin:4px 0 0;font-size:14px;">${displayName}</p>
            </div>
            <div style="background:#f8f9fa;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                <table style="width:100%;border-collapse:collapse;">
                    <tr>
                        <td style="padding:8px 0;font-weight:bold;color:#374151;width:140px;">Submitted By:</td>
                        <td style="padding:8px 0;color:#111827;">${submitterName}</td>
                    </tr>
                    <tr style="background:#fff;">
                        <td style="padding:8px;font-weight:bold;color:#374151;">Title:</td>
                        <td style="padding:8px;color:#111827;">${title}</td>
                    </tr>
                    ${description ? `
                    <tr>
                        <td style="padding:8px 0;font-weight:bold;color:#374151;">Description:</td>
                        <td style="padding:8px 0;color:#111827;">${description.replace(/\n/g, '<br>')}</td>
                    </tr>` : ''}
                    ${dateTimeStr ? `
                    <tr style="background:#fff;">
                        <td style="padding:8px;font-weight:bold;color:#374151;">Date / Time:</td>
                        <td style="padding:8px;color:#111827;">${dateTimeStr}</td>
                    </tr>` : ''}
                    ${location ? `
                    <tr>
                        <td style="padding:8px 0;font-weight:bold;color:#374151;">Location:</td>
                        <td style="padding:8px 0;color:#111827;">${location}</td>
                    </tr>` : ''}
                </table>
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
                <p style="color:#6b7280;font-size:12px;margin:0;">
                    This request was submitted via the ${displayName} website.
                    Log in to the Program Dashboard to add this announcement to a program.
                </p>
            </div>
        </div>`;

    if (!CONNECTION_STRING) {
        if (IS_PROD) throw new Error('ACS_CONNECTION_STRING is not configured.');
        toEmails.forEach(to => logDevEmail(to, subject, html));
        return { devMode: true };
    }

    const client = new EmailClient(CONNECTION_STRING);
    const message = {
        senderAddress: SENDER_ADDRESS,
        content: { subject, html },
        recipients: {
            to: toEmails.map(address => ({ address })),
        },
    };

    const poller = await client.beginSend(message);
    const result = await poller.pollUntilDone();

    if (result.status === 'Failed') {
        throw new Error(`ACS email send failed: ${result.error?.message ?? 'Unknown error'}`);
    }

    return { messageId: result.id };
};

module.exports = { sendAnnouncementRequest };