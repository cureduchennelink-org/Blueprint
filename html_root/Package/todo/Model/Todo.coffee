class Todo extends window.EpicMvc.ModelJS
	constructor: (Epic,view_nm) ->
		ss =
			show_state: 'all'
			active_item_id: false
		super Epic, view_nm, ss
		@rest= window.rest_v1
		@cache= window.cache_v1
		@cache_cb= @C_SyncTodo
		@c_is_pending= true
	action: (act,p) ->
		f= "Todo:action:#{act}"
		_log1 f, p
		r= {}
		i= new window.EpicMvc.Issue @Epic, @view_nm, act
		m= new window.EpicMvc.Issue @Epic, @view_nm, act
		switch act
			when "show" # p.state= (all|active|completed)
				@show_state= p.state
				@invalidateTables true
			when "choose_item" # p.id, p.clear
				if p.clear is true
					@active_item_id= false
				else
					@active_item_id= (Number p.id)
				@invalidateTables true
			when "save_todo" # p.id
				id= p.id
				title= p.title
				if id?
					data= title: title
					results= @rest.NoAuthPost "Prototype/Todo/Item/#{id}/update", f, data
					_log2 f, 'got update results:', results
					if results.success
						m.add 'SUCCESS'
						r.success= 'SUCCESS'
						# Uncomment to update Cache immediately
						# $.extend @c_todo.Item_idx[id], results.Item[0]
					else
						@rest.MakeIssue i, result
						r.success= 'FAIL'
				else
					data= title: title, completed: ''
					results= @rest.NoAuthPost 'Prototype/Todo/Item', f, data
					_log2 f, 'got create results:', results
					if results.success
						m.add 'SUCCESS'
						r.success= 'SUCCESS'
						# Uncomment to update Cache immediately
						# @c_todo.Item_idx[new_item.id]= results.Item[0]
					else
						@rest.MakeIssue i, result
						r.success= 'FAIL'
				@invalidateTables true
			when "delete_todo" # p.id
				results= @rest.NoAuthPost "Prototype/Todo/Item/#{p.id}/delete", f
				_log2 f, 'got delete results:', results
				if results.success is true
					m.add 'SUCCESS'
					r.success= 'SUCCESS'
					# Uncomment to update Cache immediately
					# delete @c_todo.Item_idx[p.id]
					@invalidateTables true
				else
					@rest.MakeIssue i, result
					r.success= 'FAIL'
			when "clear_completed"
				batch_ids= (item.id for id,item of @c_todo.Item_idx when item.completed is 'yes')
				data= batch_ids: batch_ids
				results= @rest.NoAuthPost "Prototype/Todo/Item/batch/delete", f, data
				_log2 f, 'got delete results:', results
				if results.success is true
					m.add 'SUCCESS'
					r.success= 'SUCCESS'
					# Uncomment to update Cache immediately
					# delete @c_todo.Item_idx[id] for id in batch_ids
					@invalidateTables true
				else
					@rest.MakeIssue i, result
					r.success= 'FAIL'
			when "mark_toggle" # p.id
				id= p.id
				data= completed: if @c_todo.Item_idx[id].completed is 'yes' then '' else 'yes'
				results= @rest.NoAuthPost "Prototype/Todo/Item/#{id}/update", f, data
				_log2 f, {results}
				if results.success
					m.add 'SUCCESS'
					r.success= 'SUCCESS'
					# Uncomment to update Cache immediately
					# $.extend @c_todo.Item_idx[id], results.Item[0]
					# @c_items= false
					@invalidateTables true
				else
					@rest.MakeIssue i, result
					r.success= 'FAIL'
			when "mark_all"
				return [r,i,m] unless @c_todo.Item.length # Guard against no Todo items
				complete_ids= []; not_complete_ids= []; completed= 'yes'
				for id,item of @c_todo.Item_idx
					if item.completed is 'yes'
						complete_ids.push id
					else not_complete_ids.push id
				if not_complete_ids.length
					batch_ids= not_complete_ids
				else
					batch_ids= complete_ids
					completed= ''
				data= { completed, batch_ids }
				results= @rest.NoAuthPost "Prototype/Todo/Item/batch/update", f, data
				_log2 f, 'got mark all results:', results
				if results.success is true
					m.add 'SUCCESS'
					r.success= 'SUCCESS'
					# Uncomment to update Cache immediately
					# $.extend @c_todo.Item_idx[id], { completed: 'yes' } for id in batch_ids
					@invalidateTables true
				else
					@rest.MakeIssue i, result
					r.success= 'FAIL'
			else return super act, p
		[r,i,m]
	loadTable: (tbl_nm) ->
		f= "loadTable:#{tbl_nm}"
		_log2 f
		item_list= @S_GetItems()
		item_list= [] if item_list is true
		switch tbl_nm
			when 'Options'
				c= 0; nc= 0
				for item in item_list
					if item.completed is 'yes' then c++ else nc++
				row=
					show_all: if @show_state is 'all' then 'yes' else ''
					show_completed: if @show_state is 'completed' then 'yes' else ''
					show_active: if @show_state is 'active' then 'yes' else ''
					not_completed_count: nc
					completed_count: c
					count: item_list.length
				@Table[tbl_nm]= [row]
			when 'Item'
				switch @show_state
					when 'all'
						rows= item_list
					when 'active'
						rows= (item for item in item_list when item.completed isnt 'yes')
					when 'completed'
						rows= (item for item in item_list when item.completed is 'yes')
				for row in rows
					row.is_editing= if row.id is @active_item_id then 'yes' else ''
				@Table[tbl_nm]= rows
			else return super tbl_nm
	fistLoadData: (oFist) ->
		switch oFist.getFistNm()
			when 'Login' then null
			else return super oFist
	S_GetItems: ()->
		f= 'Todo._getItems:'
		todos= @S_GetTodoResource()
		if todos is true
		then true # async load
		else (item for id, item of @c_todo.Item_idx)
	S_GetTodoResource: ()->
		f= 'M/Todo:S_GetTodoResource:'
		_log2 f
		return @c_todo if @c_todo
		data= @cache.GetResource 'Todo', {}, @cache_cb
		_log2 f, 'got data:', data
		@cache_cb= null
		return data if data is true # Pending load
		@c_is_pending= false
		@c_todo= data.Todo
	C_SyncTodo: (resource, data)=>
		f= 'M/Todo:C_SyncTodo:'
		_log2 f, {resource, data}
		BROKEN() if resource isnt 'Todo'
		@c_is_pending= false
		@c_todo= data.Todo
		@invalidateTables true

window.EpicMvc.Model.Todo= Todo # Public API
