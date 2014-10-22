
class MobileInset extends E.ModelJS
	constructor: (view_nm,opts) ->
		ss =
			selected_device: 'iphone-6'
			orientation: 'v' # v: vertical, h: horizontal
		super view_nm, opts, ss
	action: (ctx,act,p) ->
		f= "action:#{act}"
		_log2 f, p
		{r,i,m}= ctx
		switch act
			when "choose_device" #p.device
				@selected_device= p.device
				@invalidateTables true
			when "toggle_orientation"
				@orientation= if @orientation is 'v' then 'h' else 'v'
				@invalidateTables true
			else return super act, p
	loadTable: (tbl_nm) ->
		f= "loadTable:#{tbl_nm}"
		switch tbl_nm
			when 'Opts'
				row=
					device: @selected_device
					orientation: @orientation
				@Table[tbl_nm]= [row]
			else return super tbl_nm

E.Model.MobileInset= MobileInset # Public API
