#
# Braintree Service
#

Promise = require 'bluebird'
braintree = require 'braintree'

class BraintreeService
	@deps = services: ['error', 'logger', 'db', 'auth', 'config', 'tokenMgr'], mysql: ['ident', 'vendor']
	constructor: (kit)->
		@E = kit.services.error
		@log = kit.services.logger.log
		@sdb = kit.services.db.mysql
		@auth = kit.services.auth
		@config = kit.services.config
		@tokenMgr = kit.services.tokenMgr
		@user_id = false
		@client_token = false
		@gateway= braintree.connect
			environment: braintree.Environment[@config.braintree.environment],
			merchantId: @config.braintree.merchant_id,
			publicKey: @config.braintree.public_key,
			privateKey: @config.braintree.private_key

	get_client_token: (ctx, braintree_id) ->

		Promise.resolve().bind @
		.then ->
			@gateway.clientToken.generate if braintree_id isnt null then customerId: braintree_id else {}
		.catch (e) ->
			@handleErrors ctx, e

	add_payment_method: (ctx, nonce, user)->
		f= 'BraintreeWrapper:add_payment_method'
		{ id, braintree_id, fnm, lnm, eml } = user
		return_values= {}

		if braintree_id is null
			Promise.resolve().bind @
			.then ->

				@log.debug f, {fnm, lnm, nonce, eml}
				@gateway.customer.create
					firstName: fnm
					lastName: lnm
					paymentMethodNonce: nonce
					email: eml
			.then (response)->
				@log.debug f, {response}
				@handleErrors ctx, response.message unless response.success
				new_user_values = { braintree_id: response.customer.id }
				return_values.braintree_id = response.customer.id
				@sdb.vendor.update_by_ident_id ctx, id, new_user_values, true
			.then (db_rows)->
				@log.debug f, {db_rows}
				@handleErrors ctx, 'BRAINTREESERVICE:USER_DID_NOT_UPDATE' unless db_rows
				@get_client_token ctx, return_values.braintree_id
			.then (response)->
				return_values.token = response.clientToken
				return_values
			.catch (e) ->
				@handleErrors ctx, e

		else if braintree_id
			Promise.resolve().bind @
			.then ->
				@log.debug f, {braintree_id, nonce}
				return @gateway.paymentMethod.create
					customerId: braintree_id
					paymentMethodNonce: nonce
			.then (response)->
				@log.debug f, {response}
				@handleErrors ctx, response.message unless response.success
				{}
			.catch (e) ->
				@handleErrors ctx, e

		else throw new @E.ServerError 'BRAINTREE:ADD_PAYMENT_METHOD:INVALID_BRAINTREE_ID'

	delete_payment_method: (ctx, nonce, auth_id)->
		f= 'BraintreeWrapper:delete_payment_method'

		Promise.resolve().bind @
		.then ->
			@sdb.vendor.get_by_ident_id ctx, auth_id
		.then (db_rows)->
			throw new @E.NotFoundError 'BRAINTREE:ADD_PAYMENT_METHOD::USER_NOT_FOUND' unless db_rows.length is 1
			{braintree_id} = db_rows[0]

			# NOTE: CRB: 10/17/18, we "create" a paymentMethod because if that payment method already exists (and it should),
			# it will give us the token (i.e. identifier for that payment method) used to delete that specific payment method
			@gateway.paymentMethod.create
				customerId: braintree_id
				paymentMethodNonce: nonce
		.then (response)->
			@log.debug f, {response}
			@handleErrors ctx, response.message unless response.success
			@gateway.paymentMethod.delete response.paymentMethod.token

		.catch (e) ->
			@handleErrors ctx, e

	create_transaction: (ctx, line_items, nonce, total)->
		f = 'BRAINTREE_SERVICE:CREATE_TRANSACTION::'

		Promise.resolve().bind @
		.then ->
			@gateway.transaction.sale({
				amount: total
				paymentMethodNonce: nonce
				options: submitForSettlement: true
				lineItems: line_items
			})
		.then (response)->
			ctx.log.debug f, { response }
			@handleErrors ctx, response.message unless response.success
			response
		.catch (e)->
			@handleErrors ctx, e

	get_transaction: (ctx, transaction_id)->
		f = 'BRAINTREE_SERVICE:GET_TRANSACTION::'

		Promise.resolve().bind @
		.then ->

			@gateway.transaction.find transaction_id.toString()
		.then (response)->
			ctx.log.debug f, { response }
			@handleErrors ctx, response.message unless response.success
			response.transaction
		.catch (e)->
			@handleErrors ctx, e

	get_transaction_line_items: (ctx, transaction_id)->
		f = 'BRAINTREE_SERVICE:GET_TRANSACTION_LINE_ITEMS::'

		Promise.resolve().bind @
		.then ->
			@gateway.transactionLineItem.findAll transaction_id.toString()
		.then (response)->
			ctx.log.debug f, { response }
			response
		.catch (e)->
			@handleErrors ctx, e

	handleErrors: (ctx, e)->
		f= "TIB/r_braintree:BraintreeWrapper::handleErrors"
		ctx.log.error f, {e}
		throw new @E.ServerError 'BraintreeWrapper::handleErrors', e

exports.BraintreeService = BraintreeService
