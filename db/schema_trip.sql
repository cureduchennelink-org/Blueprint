DROP   TABLE IF EXISTS trips;
CREATE TABLE trips (
		id		INT(10)			NOT NULL AUTO_INCREMENT PRIMARY KEY
	,	di		TINYINT    		DEFAULT 0 NOT NULL /* 'disposal' - 0:none,1:disabled,2:purge*/
	,	cr		TIMESTAMP		DEFAULT 0 /* 'created' Must be first TIMESTAMP colum */
	,	mo		TIMESTAMP		DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP /* 'modified' */

	,	auth_ident_id	INT(  10 )		NOT NULL
	,	ident_id		INT(  10 )		DEFAULT NULL

	,	token			VARCHAR( 128) 	DEFAULT NULL /* Random generated key string  */
	,	domain			VARCHAR( 128) 	DEFAULT NULL /* purpose for the trip */
	,	json			TEXT		  	DEFAULT NULL /* json data associated with a trip */
	,	void			TINYINT    		DEFAULT 0 NOT NULL /* 'void' the trip */
	,	returned		DATETIME		DEFAULT NULL /* return date of trip */
	,	expires			DATETIME		DEFAULT NULL /* 'when the trip will expire' */

) ENGINE = INNODB ;
