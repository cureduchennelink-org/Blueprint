
window.EpicMvc.app$mi=
	OPTIONS: frame: OOO_mobile_inset: 'mi'
	MODELS:
		MI:      class: "MobileInset",    inst: "mi"
	CLICKS:
		mi_rotate: call: 'MI/toggle_orientation'
		mi_device: call: 'MI/choose_device', use_fields: 'device'