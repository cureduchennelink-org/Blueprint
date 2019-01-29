/* Schema for Authentication Tables
   DB Schema:
		ident: Authentication Table
		refresh_tokens: Authentication Token Table
		profile: Extended User information
*/

DROP   TABLE IF EXISTS ident;
CREATE TABLE ident (
		/* System Values*/
		id		INT(10)			NOT NULL AUTO_INCREMENT PRIMARY KEY
	,	di		TINYINT    		DEFAULT 0 NOT NULL /* 'disposal' - 0:none,1:disabled,2:purge*/
	,	cr		TIMESTAMP		DEFAULT 0 /* 'created' Must be first TIMESTAMP colum */
	,	mo		TIMESTAMP		DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP /* 'modified' */

	/* Credentials*/
	,	eml		VARCHAR( 128) UNIQUE DEFAULT NULL /* 'email' */
	,	pwd		VARCHAR( 128) DEFAULT NULL /* 'password' */

	/* Additional info encoded into access token */
	,	tenant	VARCHAR( 128) DEFAULT NULL /* tenant reference (optional) */
	,	role	VARCHAR( 128) DEFAULT NULL /* role string (optional) */
) ENGINE= INNODB ;

/* Then insert some recs for testing: */
INSERT INTO ident (id,eml,cr) VALUES
	 (99,'SYSTEM - TIMERS', NULL)
	,(98,'SYSTEM - API', NULL)
	,(97,'SYSTEM - TEST', NULL)
	/* Additional System Idents descend from here */
	;

DROP TABLE IF EXISTS ident_tokens;
CREATE TABLE ident_tokens (
		id		INT(10)			NOT NULL AUTO_INCREMENT PRIMARY KEY
	,	di		TINYINT    		DEFAULT 0 NOT NULL /* 'disposal' - 0:none,1:disabled,2:purge*/
	,	cr		TIMESTAMP		DEFAULT 0 /* 'created' Must be first TIMESTAMP colum */
	,	mo		TIMESTAMP		DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP /* 'modified' */
	,	ident_id		INT(  10 )		NOT NULL

	,	exp				DATETIME		NOT NULL
	,	client			VARCHAR(  32 )
	,	token			VARCHAR(  32 )	NOT NULL
) ENGINE= INNODB ;
CREATE UNIQUE INDEX ix_ident_tokens_token ON ident_tokens(token);
