
class MobileInset extends window.EpicMvc.ModelJS
	constructor: (Epic,view_nm) ->
		ss =
			selected_device: 'iphone-6'
			orientation: 'v' # v: vertical, h: horizontal
		super Epic, view_nm, ss
	action: (act,p) ->
		f= "action:#{act}"
		_log2 f, p
		r= {}
		i= new window.EpicMvc.Issue @Epic, @view_nm, act
		m= new window.EpicMvc.Issue @Epic, @view_nm, act
		switch act
			when "choose_device" #p.device
				@selected_device= p.device
				@invalidateTables true
			when "toggle_orientation"
				@orientation= if @orientation is 'v' then 'h' else 'v'
				@invalidateTables true
			else return super act, p
		[r,i,m]
	loadTable: (tbl_nm) ->
		debug = "loadTable:#{tbl_nm}"
		switch tbl_nm
			when 'Opts'
				row=
					device: @selected_device
					orientation: @orientation
				@Table[tbl_nm]= [row]
			else return super tbl_nm

window.EpicMvc.Model.MobileInset= MobileInset # Public API
