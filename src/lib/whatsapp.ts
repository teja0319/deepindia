import axios from 'axios';

const TOKEN = process.env.WHATSAPP_TOKEN;
const WABA_ID = process.env.WABA_ID;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const VERSION = process.env.API_VERSION || 'v21.0';

const BASE_URL = `https://graph.facebook.com/${VERSION}`;

export const fetchTemplates = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/${WABA_ID}/message_templates`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    });
    return response.data.data;
  } catch (error: any) {
    console.error('Error fetching templates:', error.response?.data || error.message);
    throw error;
  }
};

export const sendMessage = async (to: string, templateName: string, languageCode: string, components: any[]) => {
  try {
    const response = await axios.post(
      `${BASE_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode,
          },
          components,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('Error sending message:', error.response?.data || error.message);
    throw error;
  }
};
