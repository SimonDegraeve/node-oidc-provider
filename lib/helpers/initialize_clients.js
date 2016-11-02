'use strict';

function addClient(client) {
  return this.Client.add(client).then((addedClient) => {
    Object.defineProperty(addedClient, 'noManage', { value: true });
    return addedClient;
  });
}

module.exports = function initializeClients(clientsConf) {
  let clients = clientsConf;
  if (typeof clientsConf === 'undefined') clients = [];
  return Promise.all(clients.map(addClient.bind(this)));
};
