
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
