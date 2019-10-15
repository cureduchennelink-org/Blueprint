drop database if exists blueprint;
create database blueprint;
use blueprint;

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

/*
	Push Database Schema
*/

DROP   TABLE IF EXISTS psets;
CREATE TABLE psets (
		id		INT(10)			NOT NULL AUTO_INCREMENT PRIMARY KEY
	,	di		TINYINT    		DEFAULT 0 NOT NULL /* 'disposal' - 0:none,1:disabled,2:purge*/
	,	cr		TIMESTAMP		DEFAULT 0 /* 'created' Must be first TIMESTAMP colum */
	,	mo		TIMESTAMP		DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP /* 'modified' */

	,	name	VARCHAR( 128) DEFAULT NULL /* Name of the Class of Push Set */
) ENGINE = INNODB ;

DROP   TABLE IF EXISTS pset_items;
CREATE TABLE pset_items (
		id		INT(10)			NOT NULL AUTO_INCREMENT PRIMARY KEY
	,	di		TINYINT    		DEFAULT 0 NOT NULL /* 'disposal' - 0:none,1:disabled,2:purge*/
	,	cr		TIMESTAMP		DEFAULT 0 /* 'created' Must be first TIMESTAMP colum */
	,	mo		TIMESTAMP		DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP /* 'modified' */
	,	pset_id	INT(  10 )		NOT NULL

	,	xref		VARCHAR( 128) DEFAULT NULL /* external table reference */
	,	count		INT			  DEFAULT 0 /* change count */
) ENGINE = INNODB ;

DROP   TABLE IF EXISTS pset_item_changes;
CREATE TABLE pset_item_changes (
		id				INT(10)			NOT NULL AUTO_INCREMENT PRIMARY KEY
	,	di				TINYINT    		DEFAULT 0 NOT NULL /* 'disposal' - 0:none,1:disabled,2:purge*/
	,	cr				TIMESTAMP		DEFAULT 0 /* 'created' Must be first TIMESTAMP colum */
	,	mo				TIMESTAMP		DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP /* 'modified' */
	,	pset_id			INT(  10 )		NOT NULL
	,	pset_item_id	INT(  10 )		NOT NULL

	,	verb			VARCHAR( 128) DEFAULT NULL /* 'add, change, delete' */
	,	tbl				VARCHAR( 128) DEFAULT NULL /* 'table that was changed' */
	,	tbl_id			INT			  DEFAULT NULL /* 'id of record that was changed' */
	,	resource		VARCHAR(1024) DEFAULT NULL /* 'name of the resource - client visible' */
	,	prev			VARCHAR(1024) DEFAULT NULL /* 'fields and values before change' */
	,	after			VARCHAR(1024) DEFAULT NULL /* 'fields and values after change' */
) ENGINE = INNODB ;

/*
	Trip Database Schema
*/
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


DROP   TABLE IF EXISTS agent_header;
CREATE TABLE agent_header (
		id		INT(10)			NOT NULL AUTO_INCREMENT PRIMARY KEY
	,	di		TINYINT    		DEFAULT 0 NOT NULL /* 'disposal' - 0:none,1:disabled,2:purge*/
	,	cr		TIMESTAMP		DEFAULT 0 /* 'created' Must be first TIMESTAMP colum */
	,	mo		TIMESTAMP		DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP /* 'modified' */

	,	dummy				BOOLEAN default false # Toggled on upserts to get id returned
	,	agent_header_md5	VARCHAR(  64) NOT NULL
	,	agent_header		VARCHAR(2048) NOT NULL
	,	browser_name		VARCHAR( 128) DEFAULT NULL
	,	browser_version		VARCHAR( 128) DEFAULT NULL
	,	browser_major		VARCHAR( 128) DEFAULT NULL
	,	engine_name			VARCHAR( 128) DEFAULT NULL
	,	engine_version		VARCHAR( 128) DEFAULT NULL
	,	os_name				VARCHAR( 128) DEFAULT NULL
	,	os_version			VARCHAR( 128) DEFAULT NULL
	,	device_model		VARCHAR( 128) DEFAULT NULL
	,	device_vendor		VARCHAR( 128) DEFAULT NULL
	,	device_type			VARCHAR( 128) DEFAULT NULL
	,	cpu_architecture	VARCHAR( 128) DEFAULT NULL

) ENGINE = INNODB ;

CREATE UNIQUE INDEX ix_agent_header_agent_header_md5 ON agent_header(agent_header_md5);
