/* Schema for Authentication Tables
   DB Schema:
		ident: Authentication Table
		refresh_tokens: Authentication Token Table
		profile: Extended User information
*/

DROP   TABLE ident;
CREATE TABLE ident (
		/* System Values*/
		id		INT(10)			NOT NULL AUTO_INCREMENT PRIMARY KEY
	,	di		TINYINT    		DEFAULT 0 NOT NULL /* 'disposal' - 0:none,1:disabled,2:purge*/
	,	cr		TIMESTAMP		DEFAULT 0 /* 'created' Must be first TIMESTAMP colum */
	,	mo		TIMESTAMP		DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP /* 'modified' */

	/* Common Values*/
	,	eml		VARCHAR( 128) UNIQUE DEFAULT NULL /* 'email' */
	,	pwd		VARCHAR( 128) DEFAULT NULL /* 'password' */
	,	fnm		VARCHAR( 128) DEFAULT NULL /* 'first_name' */
	,	lnm		VARCHAR( 128) DEFAULT NULL /* 'last_name' */
) TYPE = INNODB ;

/* Then insert some recs for testing: */
INSERT INTO ident (id,fnm,lnm,cr) VALUES
	 (99,'Timers', 'System', NULL)
	,(98,'API', 'System', NULL)
	/* Additional System Idents descend from here */
	;

DROP TABLE ident_tokens;
CREATE TABLE ident_tokens (
		id		INT(10)			NOT NULL AUTO_INCREMENT PRIMARY KEY
	,	di		TINYINT    		DEFAULT 0 NOT NULL /* 'disposal' - 0:none,1:disabled,2:purge*/
	,	cr		TIMESTAMP		DEFAULT 0 /* 'created' Must be first TIMESTAMP colum */
	,	mo		TIMESTAMP		DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP /* 'modified' */
	,	ident_id		INT(  10 )		NOT NULL

	,	exp				DATETIME		NOT NULL
	,	client			VARCHAR(  32 )
	,	token			VARCHAR(  32 )	NOT NULL
) TYPE=INNODB ;
CREATE UNIQUE INDEX ix_ident_tokens_token ON ident_tokens(token);