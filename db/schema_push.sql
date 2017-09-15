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

