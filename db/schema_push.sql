/*
	Push Database Schema
*/

DROP   TABLE pset;
CREATE TABLE pset (
		id		INT(10)			NOT NULL AUTO_INCREMENT PRIMARY KEY
	,	di		TINYINT    		DEFAULT 0 NOT NULL /* 'disposal' - 0:none,1:disabled,2:purge*/
	,	cr		TIMESTAMP		DEFAULT 0 /* 'created' Must be first TIMESTAMP colum */
	,	mo		TIMESTAMP		DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP /* 'modified' */

	,	name	VARCHAR( 128) DEFAULT NULL /* Name of the Class of Push Set */
) TYPE = INNODB ;

DROP   TABLE pset_item;
CREATE TABLE pset_item (
		id		INT(10)			NOT NULL AUTO_INCREMENT PRIMARY KEY
	,	di		TINYINT    		DEFAULT 0 NOT NULL /* 'disposal' - 0:none,1:disabled,2:purge*/
	,	cr		TIMESTAMP		DEFAULT 0 /* 'created' Must be first TIMESTAMP colum */
	,	mo		TIMESTAMP		DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP /* 'modified' */
	,	pset_id	INT(  10 )		NOT NULL

	,	xrefa		VARCHAR( 128) DEFAULT NULL /* external table reference */
	,	count		INT			  DEFAULT NULL /* change count */
) TYPE = INNODB ;

DROP   TABLE pset_item_change;
CREATE TABLE pset_item_change (
		id		INT(10)			NOT NULL AUTO_INCREMENT PRIMARY KEY
	,	di		TINYINT    		DEFAULT 0 NOT NULL /* 'disposal' - 0:none,1:disabled,2:purge*/
	,	cr		TIMESTAMP		DEFAULT 0 /* 'created' Must be first TIMESTAMP colum */
	,	mo		TIMESTAMP		DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP /* 'modified' */
	,	pset_item_id			INT(  10 )		NOT NULL

	,	verb			VARCHAR( 128) DEFAULT NULL /* 'add, change, delete' */
	,	tbl				VARCHAR( 128) DEFAULT NULL /* 'table that was changed' */
	,	tbl_id			INT			  DEFAULT NULL /* 'id of record that was changed' */
	,	old			VARCHAR( 128) DEFAULT '{}' /* 'fields and values before change' */
	,	new			VARCHAR( 128) DEFAULT '{}' /* 'fields and values after change' */
) TYPE = INNODB ;

