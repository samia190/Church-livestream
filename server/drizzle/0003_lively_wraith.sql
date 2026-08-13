CREATE TABLE `cameraDevices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`deviceId` varchar(255) NOT NULL,
	`type` enum('webcam','external','phone','other') NOT NULL,
	`status` enum('available','in_use','offline') NOT NULL DEFAULT 'available',
	`resolution` varchar(50),
	`frameRate` int,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cameraDevices_id` PRIMARY KEY(`id`),
	CONSTRAINT `cameraDevices_deviceId_unique` UNIQUE(`deviceId`)
);
--> statement-breakpoint
CREATE TABLE `platformConnections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`platform` enum('youtube','facebook','instagram','tiktok','twitter','twitch') NOT NULL,
	`accountName` varchar(255) NOT NULL,
	`accessToken` text NOT NULL,
	`refreshToken` text,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platformConnections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `streamBroadcasts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`platform` enum('youtube','facebook','instagram','tiktok','twitter','twitch') NOT NULL,
	`broadcastUrl` text,
	`status` enum('pending','live','ended') NOT NULL DEFAULT 'pending',
	`viewerCount` int DEFAULT 0,
	`startTime` timestamp,
	`endTime` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `streamBroadcasts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `streamingSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`status` enum('scheduled','live','ended','archived') NOT NULL DEFAULT 'scheduled',
	`startTime` timestamp NOT NULL,
	`endTime` timestamp,
	`streamKey` varchar(255),
	`rtmpUrl` text,
	`isPublished` int NOT NULL DEFAULT 0,
	`recordingUrl` text,
	`viewerCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `streamingSessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `streamingSessions_streamKey_unique` UNIQUE(`streamKey`)
);
