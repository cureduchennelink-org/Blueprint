
class User extends window.EpicMvc.ModelJS
	constructor: (Epic,view_nm) ->
		ss =
			active_app: false
			username: false
			active_tab: false
		super Epic, view_nm
		@rest= window.EpicMvc.Extras.Rest # Static class
	action: (act,p) ->
		debug = "action:#{act}"
		console.log debug, p
		r= {}; i= new window.EpicMvc.Issue @Epic, @view_nm, act; m= new window.EpicMvc.Issue @Epic, @view_nm, act
		switch act
			when 'check' # Controller wants to know, valid[login]:yes/no, apps[exist]:yes/no
				if (valid= @rest.DoToken()) isnt false
					r.valid= 'yes'
				else r= valid: 'no'
			when 'parse_hash' # Page initially loaded; params.hash
				parts= p.hash.split '-'
				r= switch parts[ 0]
					when ''
						page: 'EMPTY_HASH'
					else
						page: parts[ 0], code: parts[ 1]
			when 'url_landing'
				r.url=
					if @active_app
						"app-#{@active_app}"
					else ''
			when 'url_landing_context'
				val= p.context
				@active_app= Number val if val?.length and Number val
				@Table= {}
			when "view_details" #p.id
				@active_app = Number p.id
				@Table = {}
			when "home"
				@active_app = false
				@Table = {}

			when "login" #Login Form p.AuthEmail p.LoginPass
				if p.AuthEmail is 'me'
					p.AuthEmail = 'jamie.hollowell@dv-mobile.com'
					p.LoginPass = 'password'
				result= @rest.login p.AuthEmail, p.LoginPass
				console.log debug, 'result:', result
				if result isnt false
					@Epic.login() # Let all models know what's up
					r.success= 'SUCCESS'
					@username = p.AuthEmail
				else
					#@rest.makeIssue i, result
					r.success= 'FAIL'
				console.log debug, 'r:', r
			when "logout"
				@rest.logout()
				@Epic.logout()
				@active_app = @username= false
				@Table = {}
			else return super act, p
		[r,i,m]
	loadTable: (tbl_nm) ->
		debug = "loadTable:#{tbl_nm}"
		switch tbl_nm
			when 'Me'
				results= @rest.get 'User/me', debug
				table= []
				if results.success
					table.push results.user
				console.log debug, 'table:', table
				@Table[tbl_nm]= table
			else return super tbl_nm
	fistLoadData: (oFist) ->
		switch oFist.getFistNm()
			when 'Login' then null
			else return super oFist
	fistGetFieldChoices: (oFist,field_nm) ->
		switch field_nm
			when 'DevPull' then options: [ 'Development', 'Production' ], values: [ 'yes', 'no' ]
			else return super oFist, field_nm

window.EpicMvc.Model.User= User # Public API
