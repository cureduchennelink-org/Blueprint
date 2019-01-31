
DROP   TABLE IF EXISTS profile;
CREATE TABLE profile (
		id		INT(10)			NOT NULL AUTO_INCREMENT PRIMARY KEY
	,	di		TINYINT    		DEFAULT 0 NOT NULL /* 'disposal' - 0:none,1:disabled,2:purge*/
	,	cr		TIMESTAMP		DEFAULT 0 /* 'created' Must be first TIMESTAMP colum */
	,	mo		TIMESTAMP		DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP /* 'modified' */
	,	ident_id		INT(  10 )		NOT NULL

	,	fnm				VARCHAR( 128) DEFAULT NULL /* 'first_name' */
	,	lnm				VARCHAR( 128) DEFAULT NULL /* 'last_name' */
	,	website			VARCHAR( 128) DEFAULT NULL /* 'website' */
	,	avatar_thumb	TEXT		  DEFAULT NULL /* 'avatar' as a data-url */
	,	avatar_path		VARCHAR( 128) DEFAULT NULL /* 'path to web resource' */
	,	prog_lang		VARCHAR( 128) DEFAULT NULL /* 'programming language' */
	,	skill_lvl		INT			  DEFAULT NULL /* 'skill level (0-5)' */
) ENGINE = INNODB ;

set @password := 'ACqX5b7oFXZHOozGZo809A==.wXrhYtmmqLFL8Hvr6LIo0XF+Xq1RMAhEoKF54Pw+5RA=';
INSERT INTO ident (eml,pwd,cr) VALUES
	 ('tulo@dv-mobile.com', @password, NULL)
	,('todd@dv-mobile.com', @password, NULL)
	;
