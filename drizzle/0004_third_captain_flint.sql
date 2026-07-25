CREATE TABLE `platformCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`platform` enum('youtube','facebook','instagram','tiktok','twitter','twitch','restream') NOT NULL,
	`streamKey` varchar(500),
	`streamUrl` text,
	`apiKey` text,
	`apiSecret` text,
	`accessToken` text,
	`refreshToken` text,
	`accountId` varchar(255),
	`accountName` varchar(255),
	`isActive` int NOT NULL DEFAULT 1,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platformCredentials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessionPlatformMap` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`platform` enum('youtube','facebook','instagram','tiktok','twitter','twitch') NOT NULL,
	`broadcastId` varchar(255),
	`broadcastUrl` text,
	`status` enum('pending','live','ended','failed') NOT NULL DEFAULT 'pending',
	`viewerCount` int DEFAULT 0,
	`startTime` timestamp,
	`endTime` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sessionPlatformMap_id` PRIMARY KEY(`id`)
);
