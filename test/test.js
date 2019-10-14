blueprint = require('../index');

services = ['RunQueue']
routes = ['Registration']
mysql = ['auth']

describe('ok', () => {
	it('should be ok', async () => {
		await blueprint.start(true, services, routes, true, mysql, false)
		console.log("hello!")
		return true
	});
});