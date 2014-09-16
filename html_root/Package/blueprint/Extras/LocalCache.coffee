# Takes Restore/Login/Logout events to read/set/clear cache & disk
# Tries to keep single login user's data available
# Works on two+ tabs at the same time (i.e. coordinates so only most recent tab is using the disk)
#
# Concept: (LS=localStorage key/value pair 5MB max; FS=fileSystem I/F using windows.TEMPORARY)
#  Keep single cache object in memory of everything related to the current login for the current tab
#  Having memory lets us always return values w/o callback logic
#  Storing to persitent store is either LS if in options.quickKeys (written immeadiatly), or FS (written on timed sync)
# Base functions:
#  construtor (detect if LS/FS work for us)
#  Acquire (grab persitent storage for our tab)
#  Clear (remove all trace of us)
#  Read (read from LS if possible)
#  Write (write to in memory cache; if we have acquired storage: on timer, sync to disk)
# Outside events:
#  Restore [Start a new 'tab' of re-stored state; steps on other tabs] (Acquire and read)
#   TODO RESTORE'S READ FROM DISK TO POPULATE NON-QUICK-KEYS FROM FS IS NOT YET IMPLEMENTED; WE ARE TESTING JUST WRITING THE CACHE FOR NOW
#  Login [Start a new 'tab' of stored state; steps on other tabs] (Acquire and overwrite with new data)
#  Logout [To purge any session data being held (if we had storage active)] (Clear)
#  Get (access memory cache)
#  Put (Write)
#
# Two other calls that users might want that circumvent session object
#  QuickPut/QuickGet
#  - Will ignore and return (Get: null, Put: false) when localStorage isn't available; steps on other's tabs
#  - Straight string storage, no JSON.xx encode/decode
#  - Use for e.g. save previous prompt values: localCache.QuickPut 'auth_user'

class LocalCache

	constructor: (opts) ->
		f= 'E:LocalCache:constructor'
		##_log2 f, 'opts', opts
		@options= $.extend {sizeMB: 20, flushSecs: 10, cacheName: 'lc_sess', quickKeys: ['auth_rtoken']}, opts
		@tabby= 'tab'+ Math.random() # Our tab marker, to support '@_HasAcquired()'
		@memCache= {}
		@dirty= false # True if cache needs to be written to disk
		@hasLocalStorage=
			try
				window.localStorage?.setItem 'TEST', @tabby
				@tabby is window.localStorage?.getItem 'TEST'
			catch e
				false
		@hasTempFs= false # Filled in later on callback to @checkFS setting (true, or else the error)
		@_InitTempFs() if @hasLocalStorage # Uses callbacks to get everything else set up (if at least localStorage is available)

	# Public I/F
	Restore: ->
		f= 'E:LocalCache:Restore'
		##_log2 f
		@memCache= {}
		return if not @_HasAcquired true # Take over disk if possible
		for key in @options.quickKeys
			if (val= @_ReadLS key) isnt null then @memCache[key]= val
		# TODO SCHEDULE READING THE DISK FOR REST OF KEY VALUES; MAYBE RESTORE LOCACLSTORAGE AFTER GETTING DISK KEYS
		##_log2 f, 'final @memCache', @memCache
		return
	Login: (obj) ->
		f= 'E:LocalCache:Login'
		##_log2 f, obj
		@memCache= obj
		return if not @_HasAcquired true # Take over disk if possible
		@_WriteLS key, @memCache[key] for key in @options.quickKeys when key of obj
	Logout: () ->
		f= 'E:LocalCache:Logout'
		##_log2 f
		@memCache= {}
		@dirty= true # Let sync cause an empty object value to be written
		@_FlushCache true if @hasTempFs # Don't wait for timer, true=reset has-acquire
		if @_HasAcquired()
			@_DeleteLS key for key in @options.quickKeys
			window.localStorage.removeItem 'tabby'
			# TODO DELETE FILE FROM TEMP FS
		return
	Get: (key) ->
		f= 'E:LocalCache:Get'
		##_log2 f, key, @memCache[key], 'memCache', @memCache
		@memCache[key]
	Put: (key,obj) ->
		f= 'E:LocalCache:Put'
		##_log2 f, key, obj
		@_Write key, obj

	# Direct access to localStorage; no json processsing (strings only!)
	QuickGet: (key) -> # LS; No json parsing
		f= 'E:LocalCache:QuickGet'
		##_log2 f, key
		if @hasLocalStorage then window.localStorage.getItem key else null
	QuickPut: (key,str) -> # LS; No json parsing true/false if it was persisted
		f= 'E:LocalCache:QuickPut'
		##_log2 f, key, str
		if @hasLocalStorage
			if typeof str is 'undefined'
				window.localStorage.removeItem key
			else
				window.localStorage.setItem key, str
			return true
		false

	# Internal functions
	_InitTempFs: ->
		f= 'E:LocalCache:_InitTempFs'
		##_log2 f
		@_CheckFS =>
			##_log2 f, 'after quickkeys', @memCache
	_Write: (key,obj) ->
		f= 'E:LocalCache:_Write'
		##_log2 f
		@memCache[key]= obj
		if @hasLocalStorage and key in @options.quickKeys and @_HasAcquired()
			@_WriteLS key, obj
		else
			@dirty= true
	_HasAcquired: (takeover) -> # Is our tab activaly updating storage?
		f= 'E:LocalCache:_HasAcquired'
		##_log2 f, takeover
		return @QuickPut 'tabby', @tabby if takeover is true
		(@QuickGet 'tabby') is @tabby

	# Utility
	_ReadLS: (key) ->
		obj= window.localStorage.getItem @options.cacheName+ '__'+ key
		if obj is null then null else JSON.parse obj
	_WriteLS: (key,obj) ->
		window.localStorage.setItem @options.cacheName+ '__'+ key, JSON.stringify obj
	_DeleteLS: (key) ->
		window.localStorage.removeItem @options.cacheName+ '__'+ key

	_CheckFS: (cb) ->
		f= 'E:LocalCache:_CheckFS'
		##_log2 f
		window.webkitRequestFileSystem? window.TEMPORARY ,@options.sizeMB* 1024* 1024
			,(fs) =>
				##_log2 f, 'got fs'
				@handleTempFs= fs
				@hasTempFs= true
				@setInterval= setInterval @_FlushCache, @options.flushSecs* 1000 # Only if TempFs works
				cb()
			,(err) =>
				@handleFS= err
				##_log2 f, 'got fs ERROR', err
	_FlushCache: (reset) =>
		f= 'E:LocalCache:_FlushCache'
		#_log2 f, 'interval' # TODO REMOVE
		return (@dirty= false) if @dirty isnt true or @_HasAcquired() isnt true
		# Update disk with our memory cache object
		##_log2 f, 'GOOD TO GO, getFile...'
		data= @memCache
		@handleTempFs.root.getFile @options.cacheName ,create: true
			,(entry) =>
				entry.createWriter(
					(writer) =>
						##_log2 f, 'got writer/pos/len/hacq', writer, writer.position, writer.length, @_HasAcquired()
						return if not @_HasAcquired()
						# They make you write code inside out; first write-end is writer.truncate, next is writer.write
						writer.onwriteend= (e) =>
							##_log2 f, 'truncate done pos/len', writer.position, writer.length
							writer.onwriteend= (e) =>
								##_log2 f, 'write done', e
							writer.write new Blob [ JSON.stringify data ]
						writer.onerror   = (e) => _log2 f, 'write ERROR', e
						if writer.position isnt 0 or writer.length isnt 0
							writer.truncate 0
						else writer.onwriteend() # Skip truncate, so simulate write-end
						@QuickPut 'tabby' if reset #Un-acquire (after flush started) if caller wanted us to
					,(err) => _log2 f, 'createWriter ERROR', err
					)
			,(err) => _log2 f, 'root.getFile error', err
		@dirty= false
		return

window.EpicMvc.Extras.LocalCache= LocalCache # Public API
