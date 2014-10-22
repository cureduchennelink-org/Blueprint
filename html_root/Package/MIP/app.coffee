E.app$MIP=
	SETTINGS: frames: OOO_MIP: 'mi'
	MODELS:
		MI:      class: "MobileInset",    inst: "iMIP_MobileInset"
	ACTIONS:
		MIP$rotate: do: 'MI.toggle_orientation'
		MIP$device: do: 'MI.choose_device', pass: 'device'