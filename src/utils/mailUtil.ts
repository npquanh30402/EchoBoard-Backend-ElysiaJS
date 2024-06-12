import nodemailer from "nodemailer";
import Handlebars from "handlebars";
import { CustomQueue } from "../queues/queue";
import { winstonLogger } from "../configs";

const transporter = nodemailer.createTransport({
  service: process.env.MAIL_SERVICE,
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT as unknown as number,
  secure: false, // Use `true` for port 465, `false` for all other ports
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD,
  },
});

export async function sendMail(
  mailOptions: Object,
  data: Object,
  emailSource: string,
) {
  try {
    const template = Handlebars.compile(emailSource);

    const dynamicMailOptions = {
      ...mailOptions,
      html: template(data),
    };

    const emailQueue = new CustomQueue();

    emailQueue.push(dynamicMailOptions);

    emailQueue.process(async (task: any) => {
      const info = await transporter.sendMail({
        from: process.env.MAIL_FROM_ADDRESS,
        ...task,
      });

      winstonLogger.info("Email sent: " + info.messageId);
    });
  } catch (error) {
    winstonLogger.error(error);
  }
}
