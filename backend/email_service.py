import os
import logging
from typing import Optional
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail, Content, Email
from datetime import datetime

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.sendgrid_api_key = os.environ.get('SENDGRID_API_KEY')
        self.from_email = os.environ.get('FROM_EMAIL', 'noreply@goalspark2.com')
        self.app_name = "Goal Spark 2.0"
        self.app_url = os.environ.get('FRONTEND_URL', 'https://a57f031a-35f2-4808-be33-a7b5e2b52483.preview.emergentagent.com')
        
    def _create_sendgrid_client(self) -> Optional[SendGridAPIClient]:
        """Create SendGrid client if API key is available"""
        if not self.sendgrid_api_key:
            logger.warning("SendGrid API key not found. Email sending will be simulated.")
            return None
        
        try:
            return SendGridAPIClient(api_key=self.sendgrid_api_key)
        except Exception as e:
            logger.error(f"Failed to create SendGrid client: {str(e)}")
            return None

    def _create_password_reset_html(self, reset_url: str, user_name: str = "there") -> str:
        """Create professional HTML email template for password reset"""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset - {self.app_name}</title>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }}
                .button {{ display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }}
                .button:hover {{ background-color: #1d4ed8; }}
                .footer {{ text-align: center; color: #6b7280; font-size: 14px; margin-top: 20px; }}
                .warning {{ background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎯 {self.app_name}</h1>
                    <p>Password Reset Request</p>
                </div>
                <div class="content">
                    <h2>Hello {user_name}!</h2>
                    <p>We received a request to reset your password for your {self.app_name} account.</p>
                    <p>Click the button below to reset your password:</p>
                    
                    <div style="text-align: center;">
                        <a href="{reset_url}" class="button">Reset My Password</a>
                    </div>
                    
                    <div class="warning">
                        <strong>⚠️ Security Notice:</strong>
                        <ul>
                            <li>This link will expire in 1 hour for security reasons</li>
                            <li>If you didn't request this reset, please ignore this email</li>
                            <li>Never share this link with anyone</li>
                        </ul>
                    </div>
                    
                    <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #2563eb; font-family: monospace;">{reset_url}</p>
                    
                    <p>Thanks,<br>The {self.app_name} Team</p>
                </div>
                <div class="footer">
                    <p>This email was sent by {self.app_name} - Business Intelligence Platform</p>
                    <p>Generated on {datetime.now().strftime('%B %d, %Y at %I:%M %p UTC')}</p>
                </div>
            </div>
        </body>
        </html>
        """

    def _create_password_reset_text(self, reset_url: str, user_name: str = "there") -> str:
        """Create plain text version of password reset email"""
        return f"""
🎯 {self.app_name} - Password Reset Request

Hello {user_name}!

We received a request to reset your password for your {self.app_name} account.

Please click the following link to reset your password:
{reset_url}

⚠️ SECURITY NOTICE:
- This link will expire in 1 hour for security reasons
- If you didn't request this reset, please ignore this email
- Never share this link with anyone

Thanks,
The {self.app_name} Team

---
This email was sent by {self.app_name} - Business Intelligence Platform
Generated on {datetime.now().strftime('%B %d, %Y at %I:%M %p UTC')}
        """

    async def send_password_reset_email(
        self, 
        to_email: str, 
        reset_token: str, 
        user_name: str = None
    ) -> dict:
        """
        Send password reset email to user
        
        Args:
            to_email: Recipient email address
            reset_token: Password reset token
            user_name: User's name for personalization
            
        Returns:
            dict: Result with success status and details
        """
        try:
            # Create reset URL
            reset_url = f"{self.app_url}/reset-password?token={reset_token}"
            display_name = user_name or "there"
            
            # Create email content
            html_content = self._create_password_reset_html(reset_url, display_name)
            text_content = self._create_password_reset_text(reset_url, display_name)
            
            # Try to send with SendGrid if available
            sg_client = self._create_sendgrid_client()
            
            if sg_client:
                # Create SendGrid email
                from_email_obj = Email(self.from_email, f"{self.app_name} Security")
                to_email_obj = Email(to_email)
                subject = f"🔐 Password Reset Request - {self.app_name}"
                
                # Create email with both HTML and text content
                mail = Mail(
                    from_email=from_email_obj,
                    to_emails=to_email_obj,
                    subject=subject,
                    html_content=Content("text/html", html_content),
                    plain_text_content=Content("text/plain", text_content)
                )
                
                # Send email
                response = sg_client.send(mail)
                
                logger.info(f"Password reset email sent successfully to {to_email}")
                return {
                    "success": True,
                    "provider": "sendgrid",
                    "status_code": response.status_code,
                    "message": "Password reset email sent successfully"
                }
            
            else:
                # Fallback: Log email content for development/testing
                logger.warning(f"SendGrid not configured. Simulating email send to {to_email}")
                logger.info(f"Email subject: Password Reset Request - {self.app_name}")
                logger.info(f"Reset URL: {reset_url}")
                
                return {
                    "success": True,
                    "provider": "simulation",
                    "message": "Email sending simulated (SendGrid not configured)",
                    "demo_reset_url": reset_url,
                    "demo_instructions": f"Use this URL to reset password: {reset_url}"
                }
                
        except Exception as e:
            logger.error(f"Failed to send password reset email to {to_email}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to send password reset email"
            }

    async def send_welcome_email(
        self,
        to_email: str,
        user_name: str,
        temporary_password: str = None
    ) -> dict:
        """
        Send welcome email to new users (for future use)
        
        Args:
            to_email: Recipient email address
            user_name: User's name
            temporary_password: Temporary password if applicable
            
        Returns:
            dict: Result with success status and details
        """
        try:
            sg_client = self._create_sendgrid_client()
            
            if sg_client:
                subject = f"🎯 Welcome to {self.app_name}!"
                html_content = f"""
                <h2>Welcome to {self.app_name}, {user_name}!</h2>
                <p>Your account has been created successfully.</p>
                <p>Start tracking your goals at: <a href="{self.app_url}">{self.app_url}</a></p>
                {f"<p><strong>Temporary Password:</strong> {temporary_password}</p>" if temporary_password else ""}
                <p>Thanks,<br>The {self.app_name} Team</p>
                """
                
                mail = Mail(
                    from_email=Email(self.from_email, f"{self.app_name} Team"),
                    to_emails=Email(to_email),
                    subject=subject,
                    html_content=Content("text/html", html_content)
                )
                
                response = sg_client.send(mail)
                
                logger.info(f"Welcome email sent successfully to {to_email}")
                return {
                    "success": True,
                    "provider": "sendgrid",
                    "status_code": response.status_code,
                    "message": "Welcome email sent successfully"
                }
            else:
                logger.warning(f"SendGrid not configured. Simulating welcome email to {to_email}")
                return {
                    "success": True,
                    "provider": "simulation",
                    "message": "Welcome email sending simulated"
                }
                
        except Exception as e:
            logger.error(f"Failed to send welcome email to {to_email}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to send welcome email"
            }

# Global email service instance
email_service = EmailService()