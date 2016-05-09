var socketio=require("socket.io");
var io;
var guestNumber=1;
var nickNames={};
var namesUsed=[];
var currentRoom={};

//启动socket服务器
exports.listen= function (server) {
    io=socketio.listen(server);
    io.set('log level',1);
    io.sockets.on('connection', function (socket) {
        guestNumber= assignGuestName(socket,guestNumber,nickNames,namesUsed);
        joinRoom(socket,'Lobby');
        handleMessageBroadcasting(socket,nickNames);
        handleNameChangeAttempts(socket,nickNames,namesUsed);
        handleRoomJoining(socket);
        socket.on('room',function(){
            socket.emit('rooms',io.sockets.manager.rooms);
        });
        handleClientDisconnection(socket,nickNames,namesUsed);
    });
};

//分配用户昵称
function  assignGuestName(socket,guestNumber,nickNames,namesUsed)
{
    var name="Guest"+guestNumber;
    nickNames[socket.id]=name;
    socket.emit("nameResult",{
        success:true,
        name:name
    });
    namesUsed.push(name);
    return guestNumber +1;
}
//进入聊天室
function joinRoom(socket,room){
    socket.join(room);
    currentRoom[socket.id]=room;
    socket.emit("joinResult",{room:room});
    socket.broadcast.to(room).emit('message',{
        text:nickNames[socket.id]+' 已经进入房间： ' +room+'.'
    });
    var usersInRoom=io.sockets.clients(room);
    if(usersInRoom.length>1){
        var usersInRoomSummary='当前房间： '+ room+': ';
        for(var index in usersInRoom){
            var userSocketId=usersInRoom[index].id;
            if(userSocketId!=socket.id){
                if(index>0){
                    usersInRoomSummary+=", ";
                }
                usersInRoomSummary+=nickNames[userSocketId];
            }
        }
            usersInRoomSummary+=".";
        socket.emit('message',{text:usersInRoomSummary});
    }
}

//更改用户昵称
function handleNameChangeAttempts(socket,nickNames,namesUsed){
    socket.on('nameAttempts', function (name) {
        if(name.indexOf('Guest')==0){
            socket.emit('nameResult',{
                success:false,
                message:" 用户名不能以Guest开始。 "
            });
        }
        else{
            if(namesUsed.indexOf(name)==-1){
                var previousName=nickNames[socket.id];
                var previousNameIndex=namesUsed.indexOf(previousName);
                namesUsed.push(name);
                nickNames[socket.id]=name;
                delete namesUsed[previousNameIndex];
                socket.emit('nameResult',{
                    success:true,
                    name:name
                });
            }
            else{
                socket.emit('nameResult',{
                    success:false,
                    message:"这个名称已经被其他人使用，请更换。"
                });
            }
        }
    });
}
//发送消息
function handleMessageBroadcasting(socket){
    socket.on("message",function(message){
        socket.broadcast.to(message.room).emit("message",{
            text:nickNames[socket.id]+":"+message.text
        });
    });
}
//创建房间
function handleRoomJoining(socket){
    socket.on("join", function (room) {
            socket.leave(currentRoom[socket.id]);
            joinRoom(socket,room.newRoom);
        });
}
//离线处理
function handleClientDisconnection(socket){
    socket.on('disconnect', function () {
        var nameIndex=namesUsed.indexOf(nickNames[socket.id]);
        delete namesUsed[nameIndex];
        delete nickNames[socket.id];
    });
}