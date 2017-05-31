const Client = require('node-rest-client').Client;

export class RestClient<T> {
  static get<T>(url: string, parameters: any, connectTimeout = 120000, responseTimeout = 120000): Promise<T> {
    return this.invoke('get', url, parameters, connectTimeout, responseTimeout);
  }

  static post<T>(url: string, parameters: any, connectTimeout = 120000, responseTimeout = 120000): Promise<T> {
    return this.invoke('post', url, parameters, connectTimeout, responseTimeout);
  }

  private static invoke<T>(method: string, url: string, parameters: any, connectTimeout = 120000, responseTimeout = 120000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const client = new Client();
      const args = {
        parameters: parameters,
        requestConfig: {
          timeout: connectTimeout
        },
        responseConfig: {
          timeout: responseTimeout
        }
      };
      client[method](url, args, (data: T, response: any) => {
        if (response.statusCode !== 200) {
          let message: string = "Status code: " + response.statusCode;
          try {
            if (typeof data === 'object') {
              message = String.fromCharCode.apply(null, data);
            }
          } catch (_) {
            // noop
          }
          reject({ status: response.status, message: message });
        } else if (!data) {
          reject({ message: "No data returned from service" });
        } else {
          resolve(data);
        }
      }).on('error', (err: any) => {
        reject(err);
      });
    });
  }
}
