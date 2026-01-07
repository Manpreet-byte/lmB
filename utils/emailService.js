const nodemailer = require('nodemailer');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Send email
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    // Check if email is configured
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log('Email not configured. Skipping email send.');
      console.log(`Would have sent to: ${to}`);
      console.log(`Subject: ${subject}`);
      return { success: false, message: 'Email not configured' };
    }

    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      text,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email send error:', error.message);
    return { success: false, error: error.message };
  }
};

// Email templates
const emailTemplates = {
  leaveApproved: (studentName, subject, adminName, adminEmail, leaveDates) => ({
    subject: `Leave Request Approved - ${subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4F46E5, #7C3AED); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; text-align: center;">✅ Leave Approved</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #374151;">Dear <strong>${studentName}</strong>,</p>
          <p style="font-size: 16px; color: #374151;">
            Great news! Your leave request has been <span style="color: #059669; font-weight: bold;">APPROVED</span>.
          </p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
            <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
            <p style="margin: 5px 0;"><strong>Leave Dates:</strong> ${leaveDates}</p>
            <p style="margin: 5px 0;"><strong>Approved by:</strong> ${adminName}</p>
            <p style="margin: 5px 0;"><strong>Admin Email:</strong> <a href="mailto:${adminEmail}">${adminEmail}</a></p>
          </div>
          <p style="font-size: 14px; color: #6b7280;">
            If you have any questions, please contact the admin at the email above.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">
            Leave Management System - Automated Notification
          </p>
        </div>
      </div>
    `,
    text: `Dear ${studentName},\n\nYour leave request "${subject}" for ${leaveDates} has been APPROVED by ${adminName} (${adminEmail}).\n\nIf you have any questions, please contact the admin.\n\nLeave Management System`,
  }),

  leaveRejected: (studentName, subject, adminName, adminEmail, leaveDates, reason = '') => ({
    subject: `Leave Request Rejected - ${subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #DC2626, #B91C1C); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; text-align: center;">❌ Leave Rejected</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #374151;">Dear <strong>${studentName}</strong>,</p>
          <p style="font-size: 16px; color: #374151;">
            We regret to inform you that your leave request has been <span style="color: #DC2626; font-weight: bold;">REJECTED</span>.
          </p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626;">
            <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
            <p style="margin: 5px 0;"><strong>Leave Dates:</strong> ${leaveDates}</p>
            <p style="margin: 5px 0;"><strong>Rejected by:</strong> ${adminName}</p>
            <p style="margin: 5px 0;"><strong>Admin Email:</strong> <a href="mailto:${adminEmail}">${adminEmail}</a></p>
            ${reason ? `<p style="margin: 5px 0;"><strong>Reason:</strong> ${reason}</p>` : ''}
          </div>
          <p style="font-size: 14px; color: #6b7280;">
            If you have any questions or would like to discuss this decision, please contact the admin at the email above.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">
            Leave Management System - Automated Notification
          </p>
        </div>
      </div>
    `,
    text: `Dear ${studentName},\n\nYour leave request "${subject}" for ${leaveDates} has been REJECTED by ${adminName} (${adminEmail}).${reason ? `\n\nReason: ${reason}` : ''}\n\nIf you have any questions, please contact the admin.\n\nLeave Management System`,
  }),

  testCompleted: (adminName, studentName, studentEmail, subject, score, totalQuestions, isPassed) => ({
    subject: `Test Completed - ${studentName} - ${subject}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4F46E5, #7C3AED); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; text-align: center;">📝 Test Completed</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #374151;">Dear <strong>${adminName}</strong>,</p>
          <p style="font-size: 16px; color: #374151;">
            A student has completed their leave test and requires your review.
          </p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${isPassed ? '#059669' : '#DC2626'};">
            <p style="margin: 5px 0;"><strong>Student Name:</strong> ${studentName}</p>
            <p style="margin: 5px 0;"><strong>Student Email:</strong> <a href="mailto:${studentEmail}">${studentEmail}</a></p>
            <p style="margin: 5px 0;"><strong>Leave Subject:</strong> ${subject}</p>
            <p style="margin: 5px 0;"><strong>Score:</strong> ${score}/${totalQuestions}</p>
            <p style="margin: 5px 0;"><strong>Result:</strong> 
              <span style="color: ${isPassed ? '#059669' : '#DC2626'}; font-weight: bold;">
                ${isPassed ? 'PASSED' : 'FAILED'}
              </span>
            </p>
          </div>
          <p style="font-size: 14px; color: #6b7280;">
            Please log in to the Leave Management System to approve or reject this request.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">
            Leave Management System - Automated Notification
          </p>
        </div>
      </div>
    `,
    text: `Dear ${adminName},\n\nStudent ${studentName} (${studentEmail}) has completed their test for leave request "${subject}".\n\nScore: ${score}/${totalQuestions}\nResult: ${isPassed ? 'PASSED' : 'FAILED'}\n\nPlease log in to review and approve/reject the request.\n\nLeave Management System`,
  }),
};

// Send leave approved email
const sendLeaveApprovedEmail = async (studentEmail, studentName, subject, adminName, adminEmail, leaveDates) => {
  const template = emailTemplates.leaveApproved(studentName, subject, adminName, adminEmail, leaveDates);
  return sendEmail({
    to: studentEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

// Send leave rejected email
const sendLeaveRejectedEmail = async (studentEmail, studentName, subject, adminName, adminEmail, leaveDates, reason = '') => {
  const template = emailTemplates.leaveRejected(studentName, subject, adminName, adminEmail, leaveDates, reason);
  return sendEmail({
    to: studentEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

// Send test completed email to admin
const sendTestCompletedEmail = async (adminEmail, adminName, studentName, studentEmail, subject, score, totalQuestions, isPassed) => {
  const template = emailTemplates.testCompleted(adminName, studentName, studentEmail, subject, score, totalQuestions, isPassed);
  return sendEmail({
    to: adminEmail,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
};

module.exports = {
  sendEmail,
  sendLeaveApprovedEmail,
  sendLeaveRejectedEmail,
  sendTestCompletedEmail,
};
