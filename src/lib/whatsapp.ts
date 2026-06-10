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

const mediaCache = new Map<string, string>();

async function uploadMedia(url: string, type: string): Promise<string> {
  if (mediaCache.has(url)) {
    return mediaCache.get(url)!;
  }

  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');

    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');

    let filename = 'file.png';
    let mimeType = 'image/png';
    if (type === 'video') {
      filename = 'file.mp4';
      mimeType = 'video/mp4';
    } else if (type === 'document') {
      filename = 'file.pdf';
      mimeType = 'application/pdf';
    }

    const blob = new Blob([buffer], { type: mimeType });
    formData.append('file', blob, filename);

    const uploadResponse = await axios.post(
      `${BASE_URL}/${PHONE_NUMBER_ID}/media`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
        },
      }
    );

    const mediaId = uploadResponse.data.id;
    if (mediaId) {
      mediaCache.set(url, mediaId);
      return mediaId;
    }
    throw new Error('Media ID not returned from upload');
  } catch (error: any) {
    console.error('Error uploading media to WhatsApp:', error.response?.data || error.message);
    throw error;
  }
}

export const sendMessage = async (to: string, templateName: string, languageCode: string, components: any[]) => {
  try {
    // Process components to convert Facebook CDN links to media IDs
    let processedComponents = components;
    if (components && Array.isArray(components)) {
      processedComponents = await Promise.all(
        components.map(async (comp: any) => {
          if (comp.type === 'header' && comp.parameters && Array.isArray(comp.parameters)) {
            const processedParams = await Promise.all(
              comp.parameters.map(async (param: any) => {
                const paramType = param.type; // 'image', 'video', or 'document'
                if (['image', 'video', 'document'].includes(paramType) && param[paramType]) {
                  const mediaObj = param[paramType];
                  if (mediaObj.link && (mediaObj.link.includes('scontent.whatsapp.net') || mediaObj.link.includes('scontent.xx.fbcdn.net'))) {
                    console.log(`Converting Facebook CDN media link to Media ID for parameter type "${paramType}"...`);
                    try {
                      const mediaId = await uploadMedia(mediaObj.link, paramType);
                      // Return new parameter object using id instead of link
                      const newParam = { ...param };
                      newParam[paramType] = { id: mediaId };
                      return newParam;
                    } catch (uploadErr: any) {
                      console.error('Failed to auto-upload template media. Falling back to original link parameter.', uploadErr);
                    }
                  }
                }
                return param;
              })
            );
            return { ...comp, parameters: processedParams };
          }
          return comp;
        })
      );
    }

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
          components: processedComponents,
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
