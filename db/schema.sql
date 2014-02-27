/* Template Database Schema
   DB Schema:
		t1_users: User's Table
*/

DROP   TABLE t1_users;
CREATE TABLE t1_users (
	id		    	INT(  10 )		NOT NULL AUTO_INCREMENT PRIMARY KEY ,
	email			VARCHAR( 128 )	UNIQUE DEFAULT NULL,
	password		VARCHAR(  128 )	DEFAULT NULL ,
	first_name		VARCHAR(  128 ) DEFAULT NULL,
	last_name		VARCHAR(  128 ) DEFAULT NULL,
	disposal		INT     		DEFAULT 0 NOT NULL, /*0:none,1:disabled,2:purge*/
	created			TIMESTAMP		DEFAULT 0, /* Must be first TIMESTAMP colum */
	modified		TIMESTAMP		DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) TYPE = INNODB ;

/* Then insert some recs for testing: */
set @password := 'ACqX5b7oFXZHOozGZo809A==.wXrhYtmmqLFL8Hvr6LIo0XF+Xq1RMAhEoKF54Pw+5RA=';
INSERT INTO t1_users (email,password,first_name,last_name, created)
VALUES ('tulo@dv-mobile.com', @password, 'Troy', 'Tulowitzki', NULL);
INSERT INTO t1_users (email,password,first_name,last_name, created)
VALUES ('todd@dv-mobile.com', @password, 'Todd', 'Helton', NULL);

DROP TABLE t1_refresh_tokens;
CREATE TABLE t1_refresh_tokens (
	id				INT(  10 )		NOT NULL AUTO_INCREMENT PRIMARY KEY,
	client_id		VARCHAR(  32 ),
	token			VARCHAR(  32 )	NOT NULL,
	user_id			INT(  10 )		NOT NULL,
	expires			DATETIME		NOT NULL,
	created			TIMESTAMP		DEFAULT 0,
	modified		TIMESTAMP		DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) TYPE=INNODB ;
CREATE UNIQUE INDEX ix_t1_refresh_tokens_token ON t1_refresh_tokens(token);