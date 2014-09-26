#
#	User Database Functions
#
#	A User is the join between the ident table and the profile table.
#

Q= require 'q'
E= require '../../error'


class SqlUser
	constructor: (core, kit)->
		@log= kit.services.logger.log
		@db= core
		@table= 'profile'
		@ident_tbl= 'ident'
		@schema=
			get_by_ident_id: [ # ident i LEFT OUTER JOIN profile e
				'i.id','i.eml',
				'e.fnm','e.lnm','e.cr','e.mo',
				'e.website','e.avatar_path','e.avatar_thumb','e.prog_lang','e.skill_lvl']
			update_by_ident_id: ['fnm','lnm','website','avatar_path','avatar_thumb','prog_lang','skill_lvl']
			create: ['ident_id','fnm','lnm']

		@db.method_factory @, 'SqlUser'

exports.SqlUser= SqlUser