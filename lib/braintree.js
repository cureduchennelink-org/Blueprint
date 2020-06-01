/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// Braintree Service
//

const Promise = require('bluebird');
const braintree = require('braintree');

class BraintreeService {
	static initClass() {
		this.deps = {services: ['error', 'logger', 'db', 'auth', 'config', 'tokenMgr'], mysql: ['ident', 'vendor']};
	}
	constructor(kit){
		this.E = kit.services.error;
		this.log = kit.services.logger.log;
		this.sdb = kit.services.db.mysql;
		this.auth = kit.services.auth;
		this.config = kit.services.config;
		this.tokenMgr = kit.services.tokenMgr;
		this.user_id = false;
		this.client_token = false;
		this.gateway= braintree.connect({
			environment: braintree.Environment[this.config.braintree.environment],
			merchantId: this.config.braintree.merchant_id,
			publicKey: this.config.braintree.public_key,
			privateKey: this.config.braintree.private_key
		});
	}

	get_client_token(ctx, braintree_id) {

		return Promise.resolve().bind(this)
		.then(function() {
			return this.gateway.clientToken.generate(braintree_id !== null ? {customerId: braintree_id} : {});})
		.catch(function(e) {
			return this.handleErrors(ctx, e);
		});
	}

	add_payment_method(ctx, nonce, user){
		const f= 'BraintreeWrapper:add_payment_method';
		const { id, braintree_id, fnm, lnm, eml } = user;
		const return_values= {};

		if (braintree_id === null) {
			return Promise.resolve().bind(this)
			.then(function() {

				this.log.debug(f, {fnm, lnm, nonce, eml});
				return this.gateway.customer.create({
					firstName: fnm,
					lastName: lnm,
					paymentMethodNonce: nonce,
					email: eml
				});}).then(function(response){
				this.log.debug(f, {response});
				if (!response.success) { this.handleErrors(ctx, response.message); }
				const new_user_values = { braintree_id: response.customer.id };
				return_values.braintree_id = response.customer.id;
				return this.sdb.vendor.update_by_ident_id(ctx, id, new_user_values, true);}).then(function(db_rows){
				this.log.debug(f, {db_rows});
				if (!db_rows) { this.handleErrors(ctx, 'BRAINTREESERVICE:USER_DID_NOT_UPDATE'); }
				return this.get_client_token(ctx, return_values.braintree_id);}).then(function(response){
				return_values.token = response.clientToken;
				return return_values;}).catch(function(e) {
				return this.handleErrors(ctx, e);
			});

		} else if (braintree_id) {
			return Promise.resolve().bind(this)
			.then(function() {
				this.log.debug(f, {braintree_id, nonce});
				return this.gateway.paymentMethod.create({
					customerId: braintree_id,
					paymentMethodNonce: nonce
				});}).then(function(response){
				this.log.debug(f, {response});
				if (!response.success) { this.handleErrors(ctx, response.message); }
				return {};})
			.catch(function(e) {
				return this.handleErrors(ctx, e);
			});

		} else { throw new this.E.ServerError('BRAINTREE:ADD_PAYMENT_METHOD:INVALID_BRAINTREE_ID'); }
	}

	delete_payment_method(ctx, nonce, auth_id){
		const f= 'BraintreeWrapper:delete_payment_method';

		return Promise.resolve().bind(this)
		.then(function() {
			return this.sdb.vendor.get_by_ident_id(ctx, auth_id);}).then(function(db_rows){
			if (db_rows.length !== 1) { throw new this.E.NotFoundError('BRAINTREE:ADD_PAYMENT_METHOD::USER_NOT_FOUND'); }
			const {braintree_id} = db_rows[0];

			// NOTE: CRB: 10/17/18, we "create" a paymentMethod because if that payment method already exists (and it should),
			// it will give us the token (i.e. identifier for that payment method) used to delete that specific payment method
			return this.gateway.paymentMethod.create({
				customerId: braintree_id,
				paymentMethodNonce: nonce
			});}).then(function(response){
			this.log.debug(f, {response});
			if (!response.success) { this.handleErrors(ctx, response.message); }
			return this.gateway.paymentMethod.delete(response.paymentMethod.token);}).catch(function(e) {
			return this.handleErrors(ctx, e);
		});
	}

	create_transaction(ctx, line_items, nonce, total){
		const f = 'BRAINTREE_SERVICE:CREATE_TRANSACTION::';

		return Promise.resolve().bind(this)
		.then(function() {
			return this.gateway.transaction.sale({
				amount: total,
				paymentMethodNonce: nonce,
				options: { submitForSettlement: true
			},
				lineItems: line_items
			});}).then(function(response){
			ctx.log.debug(f, { response });
			if (!response.success) { this.handleErrors(ctx, response.message); }
			return response;}).catch(function(e){
			return this.handleErrors(ctx, e);
		});
	}

	get_transaction(ctx, transaction_id){
		const f = 'BRAINTREE_SERVICE:GET_TRANSACTION::';

		return Promise.resolve().bind(this)
		.then(function() {

			return this.gateway.transaction.find(transaction_id.toString());}).then(function(response){
			ctx.log.debug(f, { response });
			if (!response.success) { this.handleErrors(ctx, response.message); }
			return response.transaction;}).catch(function(e){
			return this.handleErrors(ctx, e);
		});
	}

	get_transaction_line_items(ctx, transaction_id){
		const f = 'BRAINTREE_SERVICE:GET_TRANSACTION_LINE_ITEMS::';

		return Promise.resolve().bind(this)
		.then(function() {
			return this.gateway.transactionLineItem.findAll(transaction_id.toString());}).then(function(response){
			ctx.log.debug(f, { response });
			return response;}).catch(function(e){
			return this.handleErrors(ctx, e);
		});
	}

	handleErrors(ctx, e){
		const f= "TIB/r_braintree:BraintreeWrapper::handleErrors";
		ctx.log.error(f, {e});
		throw new this.E.ServerError('BraintreeWrapper::handleErrors', e);
	}
}
BraintreeService.initClass();

exports.BraintreeService = BraintreeService;
