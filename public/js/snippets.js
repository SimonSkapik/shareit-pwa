var Snippet = function(snp_name, temp, cb = function(d){}) {
   this.name = snp_name;
   this.template = temp;
   this.callback = cb;
};

Snippet.prototype.draw = function(data, container) {
   var code = "";
   for(ind = 0; ind < data.length; ind++){
      code += this.template(data[ind]);
   }
   $('#'+container).html(code);
   for(ind = 0; ind < data.length; ind++){
      this.callback(data[ind]);
   }
};




var SnippetManager = function() {
   this.snippets = new Array();
   this.snippet_locations = new Array();
};


SnippetManager.prototype.get_snippet_id = function(snp_name){
  for(ind = 0; ind < this.snippets.length; ind++){
     if(this.snippets[ind].name == snp_name){
        return ind;
     }
  }
  return -1;
};

SnippetManager.prototype.get_snippet_locatin_id = function(snp_lc_name){
  for(ind = 0; ind < this.snippet_locations.length; ind++){
     if(this.snippet_locations[ind].name == snp_lc_name){
        return ind;
     }
  }
  return -1;
};

SnippetManager.prototype.register_snippet = function(new_snippet){
   this.snippets.push({name : new_snippet.name, snippet : new_snippet});
};

SnippetManager.prototype.register_snippet_location = function(snp_lc_name, snp_name, cont, data_loader){
   var snp_id = this.get_snippet_id(snp_name);
   if(snp_id >= 0){
      this.snippet_locations.push({name : snp_lc_name, snippet : snp_id, container : cont, data : data_loader});
   }
};

SnippetManager.prototype.draw_snippet = function(snp_location, data){
   this.snippets[snp_location.snippet].snippet.draw(data, snp_location.container);
};

SnippetManager.prototype.invalidate_snippet = function(snp_lc_name){
   snp_location_id = this.get_snippet_locatin_id(snp_lc_name);
   if(snp_location_id >= 0){
      var snp_location = this.snippet_locations[snp_location_id];
      snp_location.data(snp_location);
   }
}

SnippetManager.prototype.new_location = function(snp_lc_name, snp_name, container, data_url, data_body = {}){
   this.register_snippet_location(snp_lc_name, snp_name, container, function(snp_loc){
      $.ajax({
         type: "POST",
         url: data_url,
         data: data_body,
         dataType: "json",
         success: function(data){
           snippet_manager.draw_snippet(snp_loc, data);
         }
      });
   });
};

snippet_manager = new SnippetManager();

var snp = new Snippet('projects', function(data){
   var template = '<a class="row_link full-width" href="/project/'+data.url_name+'" title="'+data.name+'">'+data.name+' - '+data.description+'</a>';
   return template;
});

snippet_manager.register_snippet(snp);

snp = new Snippet('conversation', function(data){
   var d = new Date(parseInt(data.timestamp));
   var n = d.toLocaleTimeString().split(':');
   var template = '<div class="conv_msg"><div style="background:#'+data.color+';">['+n[0]+':'+n[1]+'] <b>'+data.sender+'</b>: '+data.message+'</div></div>';
   return template;
});

snippet_manager.register_snippet(snp);


snp = new Snippet('notes', function(data){
   var d = new Date(parseInt(data.timestamp));
   var n = d.toLocaleTimeString().split(':');
   var template = '<div class="note"> \
         <div class="note-heading"> \
            <h3 class="note-title"> \
               <b>#'+data.number+'</b>: '+data.title+' \
            </h3>';
   if(data.access){
      template += '<div class="toolbar"> \
               <div class="toolbar-icon glyphicon glyphicon-edit" onclick="javascript:edit_note(\''+data.number+'\', \''+data.title+'\', \''+data.body+'\');" ></div> \
            </div>';
   }
   template += '      </div> \
         <h5 class="note-textline">['+n[0]+':'+n[1]+'] '+data.sender+':</h5> \
         <div class="note-body">'+data.body+'</div> \
         <h5 class="note-textline">comments:</h5> \
         <div class="note-conversation" id="note_conversation_'+data.project+'_'+data.number+'"></div> \
         <input type="text" name="note-comment-'+data.number+'" id="note_comment_'+data.number+'" value="" style="width:100%;padding:10px;" onkeypress="javascript:send_note_comment(event, this, \''+data.number+'\', \''+data.project+'\');"/> \
      </div>';
   return template;
   }, function(cb_data){
      //console.log("pred"+cb_data.number);
      //console.log(snippet_manager);
      var int = setTimeout(function(){
         snippet_manager.new_location('note_conversation_'+cb_data.project+'_'+cb_data.number, "conversation", 'note_conversation_'+cb_data.project+'_'+cb_data.number, "/get_note_conversation", {prj_url : cb_data.project, note_num : cb_data.number});
         snippet_manager.invalidate_snippet('note_conversation_'+cb_data.project+'_'+cb_data.number); 
      }, 1000);
      //console.log("po"+cb_data.number);
      //console.log(snippet_manager);
});

snippet_manager.register_snippet(snp);


snp = new Snippet('images', function(data){
   var template = '<img class="img_thumb pointer full-width" title="'+data.title+'" onclick="show_image(\''+data.img_name+'\', \''+data.title+'\', \''+data.description+'\')" src=/uploads/'+data.img_name+' />';
   if(data.access){
      template += '<div class="toolbar toolbar-img"> \
               <div class="toolbar-icon glyphicon glyphicon-remove" onclick="javascript:delete_image(\''+data.img_name+'\', \''+data.project+'\');" ></div> \
            </div>';
   }
   return template;
});

snippet_manager.register_snippet(snp);




