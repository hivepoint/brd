import { Context } from './interfaces/context';
import fs = require('fs');
import path = require('path');
import Mustache = require('mustache');
import nodemailer = require('nodemailer');
import { Initializable } from './interfaces/initializable';
import { logger, LoggerEmailHandler } from './utils/logger';
import url = require('url');

export interface EmailButton {
  caption: string;
  url: string;
}

export class EmailManager implements Initializable, LoggerEmailHandler {
  private transporter: nodemailer.Transporter;
  private baseHtmlTemplate: string;
  private baseTextTemplate: string;
  private buttonHtmlTemplate: string;
  private buttonTextTemplate: string;

  async initialize(context: Context): Promise<void> {
    if (context.getConfig('aws.ses') && !context.getConfig('email.disabled')) {
      const smtpConfig = {
        host: 'email-smtp.us-east-1.amazonaws.com',
        port: 465,
        secure: true, // use SSL
        auth: {
          user: context.getConfig('aws.ses.smtpUserName'),
          pass: context.getConfig('aws.ses.smtpPassword')
        }
      };
      this.transporter = nodemailer.createTransport(smtpConfig);
    }
    logger.registerEmailHandler(this);
  }

  async sendUsingTemplate(context: Context, fromName: string, fromEmail: string, toName: string, toEmail: string, subject: string, templateName: string, info: any, buttons: EmailButton[], skipSignature: boolean = false): Promise<void> {
    const baseHtml = this.baseHtmlTemplate || await fs.readFileSync(path.join(__dirname, '../templates/email/base.html'), 'utf8');
    const baseText = this.baseTextTemplate || await fs.readFileSync(path.join(__dirname, '../templates/email/base.txt'), 'utf8');

    let data = await fs.readFileSync(path.join(__dirname, '../templates/email/' + templateName + '.txt'), 'utf8');
    const textBody = Mustache.render(data, info);
    data = await fs.readFileSync(path.join(__dirname, '../templates/email/' + templateName + '.html'), 'utf8');
    const htmlBody = Mustache.render(data, info);

    let buttonsBodyHtml = "";
    let buttonsBodyText = "";
    if (buttons && buttons.length) {
      const buttonHtml = this.buttonHtmlTemplate || await fs.readFileSync(path.join(__dirname, '../templates/email/button.html'), 'utf8');
      const buttonText = this.buttonTextTemplate || await fs.readFileSync(path.join(__dirname, '../templates/email/button.txt'), 'utf8');
      for (const button of buttons) {
        const binfo: any = {
          caption: button.caption,
          url: button.url
        };
        buttonsBodyHtml += Mustache.render(buttonHtml, binfo);
        buttonsBodyText += Mustache.render(buttonText, binfo);
      }
    }

    const taglines = ["Search your own stuff"];
    const tagLine = taglines[Math.round(Math.random() * (taglines.length - 1))];
    const kaiLogoUrl = url.resolve(context.getConfig('baseClientUri'), '/s/images/logos/logo_800.png');
    const htmlContent = Mustache.render(baseHtml, {
      messageBody: htmlBody,
      buttons: buttonsBodyHtml,
      signature: skipSignature ? "" : "Your personal cloud search engine,",
      tagLine: tagLine,
      kaiLogoUrl: kaiLogoUrl
    });
    const textContent = Mustache.render(baseText, {
      messageBody: textBody,
      buttons: buttonsBodyText,
      signature: skipSignature ? "" : "Your personal cloud search engine,",
    });

    await this.send(context, fromName, fromEmail, toName, toEmail, subject, textContent, htmlContent);
  }

  async send(context: Context, fromName: string, fromEmail: string, toName: string, toEmail: string, subject: string, text: string, html: string): Promise<void> {
    if (this.transporter) {
      let from = '<' + fromEmail + '>';
      if (fromName) {
        from = '"' + fromName + '" ' + from;
      }
      let to = '<' + toEmail + '>';
      if (toName) {
        to = '"' + toName + '" ' + to;
      }
      await this.transporter.sendMail({
        from: from,
        to: to,
        subject: subject,
        text: text,
        html: html
      });
      logger.log(context, "email", "send", "Sent mail to " + toEmail, subject);
    } else {
      logger.warn(context, "email", "send", "Outbound email has been suppressed because of configuration");
    }
  }

}

const emailManager = new EmailManager();

export { emailManager }
