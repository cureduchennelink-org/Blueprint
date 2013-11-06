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
INSERT INTO t1_users (email,password,first_name,last_name, created)
VALUES ('tulo@dv-mobile.com', 'W0rlDChAmp5', 'Troy', 'Tulowitzki', NULL);
INSERT INTO t1_users (email,password,first_name,last_name, created)
VALUES ('todd@dv-mobile.com', 'T0ddFAtheR', 'Todd', 'Helton', NULL);